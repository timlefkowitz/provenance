'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminUser } from '~/lib/admin';
import { sendTransactionalEmailStrict, isEmailConfigured } from '~/lib/email';
import {
  getInviteEmailSubject,
  renderInviteEmailHtml,
} from '~/lib/email-templates-store';
import { parseEmailList } from '~/lib/lead-email-parse';
import {
  assessLeadEmailQuality,
  canSendOutreachInvite,
  type LeadEmailQuality,
} from '~/lib/lead-email-quality';
import {
  fetchAlreadyInvitedEmails,
  logAdminOutreachSend,
} from '~/lib/admin-outreach-sends';

const MAX_RECIPIENTS = 500;


export type LeadInviteOutreachRow = {
  email: string;
  quality: LeadEmailQuality;
  reason: string;
  alreadyInvited: boolean;
  lastInvitedAt: string | null;
  canSend: boolean;
};

export type PreviewLeadInviteOutreachResult =
  | {
      ok: true;
      rows: LeadInviteOutreachRow[];
      summary: {
        total: number;
        good: number;
        maybe: number;
        bad: number;
        alreadyInvited: number;
        readyToSend: number;
      };
    }
  | { ok: false; error: string };

const previewSchema = z.object({
  rawText: z.string().min(1, 'Paste at least one email address.'),
  includeMaybe: z.boolean().optional(),
});

export async function previewLeadInviteOutreach(
  input: z.infer<typeof previewSchema>,
): Promise<PreviewLeadInviteOutreachResult> {
  console.log('[Admin/leads] previewLeadInviteOutreach started');
  try {
    await requireAdminUser();
    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const includeMaybe = parsed.data.includeMaybe ?? false;
    const emails = parseEmailList(parsed.data.rawText).slice(0, MAX_RECIPIENTS);

    if (emails.length === 0) {
      return { ok: false, error: 'No email addresses found in pasted text.' };
    }

    const alreadyInvited = await fetchAlreadyInvitedEmails(emails);

    const rows: LeadInviteOutreachRow[] = emails.map((email) => {
      const { quality, reason } = assessLeadEmailQuality(email);
      const lastInvitedAt = alreadyInvited.get(email) ?? null;
      const alreadyInvitedFlag = lastInvitedAt !== null;
      const qualityOk = canSendOutreachInvite(quality, includeMaybe);
      return {
        email,
        quality,
        reason,
        alreadyInvited: alreadyInvitedFlag,
        lastInvitedAt,
        canSend: qualityOk && !alreadyInvitedFlag,
      };
    });

    const summary = {
      total: rows.length,
      good: rows.filter((r) => r.quality === 'good').length,
      maybe: rows.filter((r) => r.quality === 'maybe').length,
      bad: rows.filter((r) => r.quality === 'bad').length,
      alreadyInvited: rows.filter((r) => r.alreadyInvited).length,
      readyToSend: rows.filter((r) => r.canSend).length,
    };

    console.log('[Admin/leads] previewLeadInviteOutreach done', summary);
    return { ok: true, rows, summary };
  } catch (e) {
    console.error('[Admin/leads] previewLeadInviteOutreach failed', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to preview outreach list',
    };
  }
}

export type SendLeadInviteOutreachResult =
  | {
      ok: true;
      sent: string[];
      skipped: { email: string; reason: string }[];
      failed: { email: string; error: string }[];
    }
  | { ok: false; error: string };

const sendSchema = z.object({
  rawText: z.string().min(1),
  includeMaybe: z.boolean().optional(),
});

export async function sendLeadInviteOutreach(
  input: z.infer<typeof sendSchema>,
): Promise<SendLeadInviteOutreachResult> {
  console.log('[Admin/leads] sendLeadInviteOutreach started');
  try {
    const { user } = await requireAdminUser();

    if (!isEmailConfigured()) {
      return {
        ok: false,
        error: 'Resend is not configured. Set RESEND_API_KEY to send emails.',
      };
    }

    const parsed = sendSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const preview = await previewLeadInviteOutreach(parsed.data);
    if (!preview.ok) {
      return { ok: false, error: preview.error };
    }

    const toSend = preview.rows.filter((r) => r.canSend);
    if (toSend.length === 0) {
      return {
        ok: false,
        error:
          'No sendable addresses. Review quality scores and prior invite history.',
      };
    }

    const [subject, htmlTemplate] = await Promise.all([
      getInviteEmailSubject(),
      renderInviteEmailHtml('there'),
    ]);

    const sent: string[] = [];
    const skipped: { email: string; reason: string }[] = [];
    const failed: { email: string; error: string }[] = [];

    let processedSends = 0;
    for (const row of preview.rows) {
      if (!row.canSend) {
        let reason = 'not_sendable';
        if (row.alreadyInvited) reason = 'already_invited';
        else if (row.quality === 'bad') reason = row.reason;
        else if (row.quality === 'maybe') reason = 'maybe_quality_excluded';

        skipped.push({ email: row.email, reason });
        await logAdminOutreachSend({
          email: row.email,
          status: 'skipped',
          skipReason: reason,
          quality: row.quality,
          sentBy: user.id,
        });
        continue;
      }

      const res = await sendTransactionalEmailStrict({
        to: row.email,
        subject,
        html: htmlTemplate,
      });

      processedSends += 1;

      if (res.ok) {
        sent.push(row.email);
        await logAdminOutreachSend({
          email: row.email,
          status: 'sent',
          quality: row.quality,
          sentBy: user.id,
        });
      } else {
        failed.push({ email: row.email, error: res.error });
        await logAdminOutreachSend({
          email: row.email,
          status: 'failed',
          quality: row.quality,
          errorMessage: res.error,
          sentBy: user.id,
        });
      }

      if (processedSends < toSend.length) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    console.log('[Admin/leads] sendLeadInviteOutreach done', {
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
    });

    revalidatePath('/admin/leads');
    return { ok: true, sent, skipped, failed };
  } catch (e) {
    console.error('[Admin/leads] sendLeadInviteOutreach failed', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to send invite emails',
    };
  }
}
