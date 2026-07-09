'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminUser } from '~/lib/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendTransactionalEmailStrict } from '~/lib/email';
import { logAdminOutreachSend } from '~/lib/admin-outreach-sends';
import { buildEmailPreviewHtml } from '~/lib/email-templates-store';
import {
  DEFAULT_EMAIL_MARKDOWN,
  DEFAULT_EMAIL_SUBJECTS,
  type EmailTemplateKey,
} from '~/lib/email-defaults';
import {
  EMAIL_LAYOUT_PRESET_IDS,
  type AdminEmailThemeDraft,
  defaultAdminEmailThemeDraft,
  getPresetThemeDefaults,
  normalizeEmailLayoutPreset,
  resolveEmailThemeFromAdminDraft,
} from '~/lib/email-layout-presets';
import type { EmailTheme } from '~/lib/email-layout';

const PRESET_ENUM = EMAIL_LAYOUT_PRESET_IDS as unknown as [string, ...string[]];

const settingsSchema = z.object({
  layout_preset:     z.enum(PRESET_ENUM),
  masthead_title:    z.string().min(1).max(120),
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
    'invite',
  ]),
  subject:       z.string().min(1).max(500),
  body_markdown: z.string().min(1).max(100_000),
});

const previewPayloadSchema = z.object({
  template_key:  templateSchema.shape.template_key,
  subject:       z.string().min(1).max(500),
  body_markdown: z.string().min(1).max(100_000),
  theme:         settingsSchema,
});

const MAX_RECIPIENTS_PER_SEND = 500;

const recipientsPayloadSchema = previewPayloadSchema.extend({
  recipients: z
    .array(z.string().trim().email())
    .min(1, 'Add at least one recipient email address.')
    .max(MAX_RECIPIENTS_PER_SEND, `Limit ${MAX_RECIPIENTS_PER_SEND} recipients per send.`),
});


function dbRowToDraft(row: Record<string, unknown>): AdminEmailThemeDraft {
  const d = defaultAdminEmailThemeDraft();
  return {
    layout_preset:
      normalizeEmailLayoutPreset(row.layout_preset),
    masthead_title:
      typeof row.masthead_title === 'string' && row.masthead_title
        ? row.masthead_title
        : d.masthead_title,
    masthead_subtitle:
      typeof row.masthead_subtitle === 'string' && row.masthead_subtitle
        ? row.masthead_subtitle
        : d.masthead_subtitle,
  };
}

export type EmailTemplatesAdminPayload = {
  theme: AdminEmailThemeDraft;
  templates: Record<EmailTemplateKey, { subject: string; bodyMarkdown: string }>;
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

  const theme: AdminEmailThemeDraft = settingsRow
    ? dbRowToDraft(settingsRow)
    : defaultAdminEmailThemeDraft();

  const { data: templateRows, error: tplErr } = await admin
    .from('email_templates')
    .select('template_key, subject, body_markdown');

  if (tplErr) {
    console.error('[Admin/emails] email_templates read failed', tplErr);
  }

  const byKey = new Map<string, { subject: string; body_markdown: string }>();
  for (const row of templateRows ?? []) {
    byKey.set(row.template_key, {
      subject:       row.subject,
      body_markdown: row.body_markdown,
    });
  }

  const keys = Object.keys(DEFAULT_EMAIL_MARKDOWN) as EmailTemplateKey[];
  const templates = {} as EmailTemplatesAdminPayload['templates'];
  for (const k of keys) {
    const row = byKey.get(k);
    templates[k] = {
      subject:      row?.subject       ?? DEFAULT_EMAIL_SUBJECTS[k],
      bodyMarkdown: row?.body_markdown ?? DEFAULT_EMAIL_MARKDOWN[k],
    };
  }

  return { theme, templates };
}

export async function saveEmailTheme(
  input: z.infer<typeof settingsSchema>,
): Promise<{ ok: boolean; error?: string }> {
  console.log('[Admin/emails] saveEmailTheme started');
  try {
    await requireAdminUser();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.flatten().formErrors.join(', ') };
    }

    const presetId = parsed.data.layout_preset as import('~/lib/email-layout').EmailLayoutPresetId;
    const preset   = getPresetThemeDefaults(presetId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not in generated DB types yet
    const admin = getSupabaseServerAdminClient() as any;
    const { data: existing } = await admin
      .from('email_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const payload = {
      layout_preset:     presetId,
      parchment:         preset.parchment,
      ink:               preset.ink,
      wine:              preset.wine,
      ink_subtitle:      preset.inkSubtitle,
      ink_muted:         preset.inkMuted,
      masthead_title:    parsed.data.masthead_title,
      masthead_subtitle: parsed.data.masthead_subtitle,
      updated_at:        new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await admin
        .from('email_settings')
        .update(payload)
        .eq('id', existing.id);
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

    console.log('[Admin/emails] email theme saved', presetId);
    revalidatePath('/admin/emails');
    return { ok: true };
  } catch (e) {
    console.error('[Admin/emails] saveEmailTheme', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to save' };
  }
}

export async function previewEmailTemplate(
  input: z.infer<typeof previewPayloadSchema>,
): Promise<{ ok: true; html: string; previewSubject: string } | { ok: false; error: string }> {
  try {
    await requireAdminUser();
    const parsed = previewPayloadSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.flatten().formErrors.join(', ') || 'Invalid preview payload',
      };
    }

    const theme: EmailTheme = resolveEmailThemeFromAdminDraft(parsed.data.theme as AdminEmailThemeDraft);

    console.log('[Admin/emails] previewEmailTemplate', parsed.data.template_key, parsed.data.theme.layout_preset);
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
    const { user } = await requireAdminUser();
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

    const theme = resolveEmailThemeFromAdminDraft(parsed.data.theme as AdminEmailThemeDraft);

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

export type SendToRecipientsResult =
  | { ok: true; sent: string[]; failed: { email: string; error: string }[] }
  | { ok: false; error: string };

/**
 * Send a template to an arbitrary list of external email addresses.
 * Recipients do not need to be existing users.
 */
export async function sendEmailTemplateToRecipients(
  input: z.infer<typeof recipientsPayloadSchema>,
): Promise<SendToRecipientsResult> {
  console.log('[Admin/emails] sendEmailTemplateToRecipients started');
  try {
    const { user } = await requireAdminUser();

    const parsed = recipientsPayloadSchema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.message).join(', ');
      return { ok: false, error: issues || 'Invalid payload' };
    }

    const recipients = Array.from(
      new Set(parsed.data.recipients.map((r) => r.trim().toLowerCase())),
    );

    const theme = resolveEmailThemeFromAdminDraft(parsed.data.theme as AdminEmailThemeDraft);

    // Real recipients shouldn't see the preview sample name ("Alex Rivera").
    // Pre-fill greeting placeholders with a generic salutation before rendering.
    const bodyMarkdown = parsed.data.body_markdown
      .split('{{name}}').join('there')
      .split('{{artistName}}').join('there');

    const { html, previewSubject } = buildEmailPreviewHtml(
      parsed.data.template_key,
      theme,
      parsed.data.subject,
      bodyMarkdown,
    );

    console.log(
      '[Admin/emails] sendEmailTemplateToRecipients sending',
      parsed.data.template_key,
      `${recipients.length} recipient(s)`,
    );

    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];

    // Sequential with a small delay to stay under Resend rate limits (~2 req/s).
    for (const email of recipients) {
      const res = await sendTransactionalEmailStrict({
        to: email,
        subject: previewSubject,
        html,
      });
      if (res.ok) {
        sent.push(email);
        if (parsed.data.template_key === 'invite') {
          await logAdminOutreachSend({
            email,
            status: 'sent',
            sentBy: user.id,
          });
        }
      } else {
        failed.push({ email, error: res.error });
        if (parsed.data.template_key === 'invite') {
          await logAdminOutreachSend({
            email,
            status: 'failed',
            errorMessage: res.error,
            sentBy: user.id,
          });
        }
      }
      if (recipients.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    if (failed.length > 0) {
      console.error('[Admin/emails] sendEmailTemplateToRecipients partial failures', failed);
    }
    console.log(
      '[Admin/emails] sendEmailTemplateToRecipients done',
      `sent=${sent.length} failed=${failed.length}`,
    );
    return { ok: true, sent, failed };
  } catch (e) {
    console.error('[Admin/emails] sendEmailTemplateToRecipients failed', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to send emails',
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
        template_key:  parsed.data.template_key,
        subject:       parsed.data.subject,
        body_markdown: parsed.data.body_markdown,
        updated_at:    new Date().toISOString(),
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
