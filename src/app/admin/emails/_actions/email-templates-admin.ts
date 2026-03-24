'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isAdmin } from '~/lib/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { DEFAULT_EMAIL_THEME } from '~/lib/email-templates-store';
import {
  DEFAULT_EMAIL_MARKDOWN,
  DEFAULT_EMAIL_SUBJECTS,
  type EmailTemplateKey,
} from '~/lib/email-defaults';
import type { EmailTheme } from '~/lib/email-layout';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const settingsSchema = z.object({
  parchment: hexColor,
  ink: hexColor,
  wine: hexColor,
  ink_subtitle: hexColor,
  ink_muted: hexColor,
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
  ]),
  subject: z.string().min(1).max(500),
  body_markdown: z.string().min(1).max(100_000),
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

export type EmailTemplatesAdminPayload = {
  theme: EmailTheme;
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

  const theme: EmailTheme = settingsRow
    ? {
        parchment: settingsRow.parchment ?? DEFAULT_EMAIL_THEME.parchment,
        ink: settingsRow.ink ?? DEFAULT_EMAIL_THEME.ink,
        wine: settingsRow.wine ?? DEFAULT_EMAIL_THEME.wine,
        inkSubtitle: settingsRow.ink_subtitle ?? DEFAULT_EMAIL_THEME.inkSubtitle,
        inkMuted: settingsRow.ink_muted ?? DEFAULT_EMAIL_THEME.inkMuted,
        mastheadTitle: settingsRow.masthead_title ?? DEFAULT_EMAIL_THEME.mastheadTitle,
        mastheadSubtitle:
          settingsRow.masthead_subtitle ?? DEFAULT_EMAIL_THEME.mastheadSubtitle,
        fontFamily: DEFAULT_EMAIL_THEME.fontFamily,
      }
    : DEFAULT_EMAIL_THEME;

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
  try {
    await requireAdminUser();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.flatten().formErrors.join(', ') };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not in generated DB types yet
    const admin = getSupabaseServerAdminClient() as any;
    const { data: existing } = await admin.from('email_settings').select('id').limit(1).maybeSingle();

    const payload = {
      parchment: parsed.data.parchment,
      ink: parsed.data.ink,
      wine: parsed.data.wine,
      ink_subtitle: parsed.data.ink_subtitle,
      ink_muted: parsed.data.ink_muted,
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
