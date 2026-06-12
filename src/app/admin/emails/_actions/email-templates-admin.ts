'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isAdmin } from '~/lib/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendTransactionalEmailStrict } from '~/lib/email';
import { buildEmailPreviewHtml } from '~/lib/email-templates-store';
import {
  DEFAULT_EMAIL_MARKDOWN,
  DEFAULT_EMAIL_SUBJECTS,
  type EmailTemplateKey,
} from '~/lib/email-defaults';
import type { AdminEmailThemeDraft } from '~/lib/email-layout-presets';
import {
  defaultAdminEmailThemeDraft,
  getPresetThemeDefaults,
  resolveEmailThemeFromAdminDraft,
} from '~/lib/email-layout-presets';
import type { EmailTheme } from '~/lib/email-layout';

const settingsSchema = z.object({
  masthead_title: z.string().min(1).max(120),
  masthead_subtitle: z.string().min(1).max(200),
});

const templateSchema = z.object({
  template_key: z.enum([
    'welcome',
    'certification',
    'notification',
    'summary',
    'update',
    'artwork_featured',
    'institution_thanks',
  ]),
  subject: z.string().min(1).max(500),
  body_markdown: z.string().min(1).max(100_000),
});

const previewPayloadSchema = z.object({
  template_key: templateSchema.shape.template_key,
  subject: z.string().min(1).max(500),
  body_markdown: z.string().min(1).max(100_000),
  theme: settingsSchema,
});

async function requireAdminUser() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    throw new Error('Unauthorized');
  }
  return user;
}

function dbRowToDraft(row: Record<string, unknown>): AdminEmailThemeDraft {
  const d = defaultAdminEmailThemeDraft();
  return {
    masthead_title:
      typeof row.masthead_title === 'string' && row.masthead_title ? row.masthead_title : d.masthead_title,
    masthead_subtitle:
      typeof row.masthead_subtitle === 'string' && row.masthead_subtitle
        ? row.masthead_subtitle
        : d.masthead_subtitle,
  };
}

export type EmailTemplatesAdminPayload = {
  theme: AdminEmailThemeDraft;
  templates: Record<
    EmailTemplateKey,
    { subject: string; bodyMarkdown: string }
  >;
};

export async function getEmailTemplatesAdminData(): Promise<EmailTemplatesAdminPayload> {
  await requireAdminUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not in generated DB types yet
  const admin = getSupabaseServerAdminClient() as any;

  const { data: settingsRow, error: settingsErr } = await admin
    .from('email_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (settingsErr) {
    console.error('[Admin/emails] email_settings read failed', settingsErr);
  }

  const theme: AdminEmailThemeDraft = settingsRow ? dbRowToDraft(settingsRow) : defaultAdminEmailThemeDraft();

  const { data: templateRows, error: tplErr } = await admin
    .from('email_templates')
    .select('template_key, subject, body_markdown');

  if (tplErr) {
    console.error('[Admin/emails] email_templates read failed', tplErr);
  }

  const byKey = new Map<string, { subject: string; body_markdown: string }>();
  for (const row of templateRows ?? []) {
    byKey.set(row.template_key, {
      subject: row.subject,
      body_markdown: row.body_markdown,
    });
  }

  const keys = Object.keys(DEFAULT_EMAIL_MARKDOWN) as EmailTemplateKey[];
  const templates = {} as EmailTemplatesAdminPayload['templates'];
  for (const k of keys) {
    const row = byKey.get(k);
    templates[k] = {
      subject: row?.subject ?? DEFAULT_EMAIL_SUBJECTS[k],
      bodyMarkdown: row?.body_markdown ?? DEFAULT_EMAIL_MARKDOWN[k],
    };
  }

  return { theme, templates };
}

export async function saveEmailTheme(input: z.infer<typeof settingsSchema>): Promise<{ ok: boolean; error?: string }> {
  console.log('[Admin/emails] saveEmailTheme started');
  try {
    await requireAdminUser();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.flatten().formErrors.join(', ') };
    }

    const preset = getPresetThemeDefaults('minimal');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not in generated DB types yet
    const admin = getSupabaseServerAdminClient() as any;
    const { data: existing } = await admin.from('email_settings').select('id').limit(1).maybeSingle();

    const payload = {
      layout_preset: 'minimal',
      parchment: preset.parchment,
      ink: preset.ink,
      wine: preset.wine,
      ink_subtitle: preset.inkSubtitle,
      ink_muted: preset.inkMuted,
      masthead_title: parsed.data.masthead_title,
      masthead_subtitle: parsed.data.masthead_subtitle,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await admin.from('email_settings').update(payload).eq('id', existing.id);
      if (error) {
        console.error('[Admin/emails] saveEmailTheme update failed', error);
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await admin.from('email_settings').insert(payload);
      if (error) {
        console.error('[Admin/emails] saveEmailTheme insert failed', error);
        return { ok: false, error: error.message };
      }
    }

    console.log('[Admin/emails] email theme saved');
    revalidatePath('/admin/emails');
    return { ok: true };
  } catch (e) {
    console.error('[Admin/emails] saveEmailTheme', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to save' };
  }
}

export async function previewEmailTemplate(
  input: z.infer<typeof previewPayloadSchema>,
): Promise<
  | { ok: true; html: string; previewSubject: string }
  | { ok: false; error: string }
> {
  try {
    await requireAdminUser();
    const parsed = previewPayloadSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.flatten().formErrors.join(', ') || 'Invalid preview payload',
      };
    }

    const theme: EmailTheme = resolveEmailThemeFromAdminDraft(parsed.data.theme);

    console.log('[Admin/emails] previewEmailTemplate', parsed.data.template_key);
    const { html, previewSubject } = buildEmailPreviewHtml(
      parsed.data.template_key,
      theme,
      parsed.data.subject,
      parsed.data.body_markdown,
    );
    return { ok: true, html, previewSubject };
  } catch (e) {
    console.error('[Admin/emails] previewEmailTemplate failed', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to build preview',
    };
  }
}

export async function sendTestEmailTemplate(
  input: z.infer<typeof previewPayloadSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[Admin/emails] sendTestEmailTemplate started');
  try {
    const user = await requireAdminUser();
    const to = user.email;
    if (!to) {
      console.error('[Admin/emails] sendTestEmailTemplate: user has no email');
      return { ok: false, error: 'Your account has no email address on file.' };
    }

    const parsed = previewPayloadSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.flatten().formErrors.join(', ') || 'Invalid payload',
      };
    }

    const theme = resolveEmailThemeFromAdminDraft(parsed.data.theme);

    const { html, previewSubject } = buildEmailPreviewHtml(
      parsed.data.template_key,
      theme,
      parsed.data.subject,
      parsed.data.body_markdown,
    );

    const sendResult = await sendTransactionalEmailStrict({
      to,
      subject: `[Test] ${previewSubject}`,
      html,
    });

    if (!sendResult.ok) {
      console.error('[Admin/emails] sendTestEmailTemplate send failed', sendResult.error);
      return sendResult;
    }

    console.log('[Admin/emails] sendTestEmailTemplate success', to);
    return { ok: true };
  } catch (e) {
    console.error('[Admin/emails] sendTestEmailTemplate failed', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to send test email',
    };
  }
}

export async function saveEmailTemplate(
  input: z.infer<typeof templateSchema>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminUser();
    const parsed = templateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.flatten().formErrors.join(', ') };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not in generated DB types yet
    const admin = getSupabaseServerAdminClient() as any;
    const { error } = await admin.from('email_templates').upsert(
      {
        template_key: parsed.data.template_key,
        subject: parsed.data.subject,
        body_markdown: parsed.data.body_markdown,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'template_key' },
    );

    if (error) {
      console.error('[Admin/emails] saveEmailTemplate failed', error);
      return { ok: false, error: error.message };
    }

    console.log('[Admin/emails] template saved', parsed.data.template_key);
    revalidatePath('/admin/emails');
    return { ok: true };
  } catch (e) {
    console.error('[Admin/emails] saveEmailTemplate', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to save' };
  }
}
