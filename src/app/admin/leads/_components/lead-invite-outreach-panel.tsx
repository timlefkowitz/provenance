'use client';

import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from 'sonner';

import {
  previewLeadInviteOutreach,
  sendLeadInviteOutreach,
  type LeadInviteOutreachRow,
  type PreviewLeadInviteOutreachResult,
} from '../_actions/lead-invite-outreach';

const QUALITY_LABEL: Record<LeadInviteOutreachRow['quality'], string> = {
  good: 'good',
  maybe: 'maybe',
  bad: 'bad',
};

const QUALITY_CLASS: Record<LeadInviteOutreachRow['quality'], string> = {
  good: 'text-emerald-300',
  maybe: 'text-amber-300',
  bad: 'text-red-300',
};

export function LeadInviteOutreachPanel() {
  const [rawText, setRawText] = useState('');
  const [includeMaybe, setIncludeMaybe] = useState(false);
  const [preview, setPreview] = useState<PreviewLeadInviteOutreachResult | null>(
    null,
  );
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);

  async function onReview() {
    setReviewing(true);
    console.log('[LeadInviteOutreachPanel] review started');
    try {
      const result = await previewLeadInviteOutreach({ rawText, includeMaybe });
      setPreview(result);
      if (!result.ok) {
        toast.error(result.error);
      }
    } finally {
      setReviewing(false);
    }
  }

  async function onSend() {
    if (!preview?.ok || preview.summary.readyToSend === 0) {
      toast.error('Review the list first and ensure there are sendable addresses.');
      return;
    }

    const confirmed = window.confirm(
      `Send the invite email to ${preview.summary.readyToSend} address(es)?`,
    );
    if (!confirmed) return;

    setSending(true);
    console.log('[LeadInviteOutreachPanel] send started');
    try {
      const result = await sendLeadInviteOutreach({ rawText, includeMaybe });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Sent ${result.sent.length} invite(s). Skipped ${result.skipped.length}, failed ${result.failed.length}.`,
      );

      if (result.failed.length > 0) {
        console.error('[LeadInviteOutreachPanel] send failures', result.failed);
      }

      const refreshed = await previewLeadInviteOutreach({ rawText, includeMaybe });
      setPreview(refreshed);
    } finally {
      setSending(false);
    }
  }

  const summary = preview?.ok ? preview.summary : null;
  const rows = preview?.ok ? preview.rows : [];

  return (
    <section className="rounded-md border border-[#c9a227]/25 bg-[#c9a227]/5 p-4">
      <h2 className="font-mono text-[12px] uppercase tracking-wide text-[#e8c547]">
        invite outreach
      </h2>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-400">
        Paste emails (one per line or comma-separated). We check format &amp; domain
        quality, skip addresses already sent the{' '}
        <span className="text-slate-300">Invite</span> template from admin/emails,
        then send via Resend.
      </p>

      <label className="mt-4 block">
        <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[#c9a227]/80">
          Email list
        </span>
        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setPreview(null);
          }}
          rows={8}
          placeholder={'artist@studio.com\nregistrar@school.edu\n…'}
          className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[12px] text-slate-200 outline-none focus:border-[#c9a227]/50"
        />
      </label>

      <label className="mt-3 flex cursor-pointer items-center gap-2 font-mono text-[12px] text-slate-400">
        <input
          type="checkbox"
          checked={includeMaybe}
          onChange={(e) => {
            setIncludeMaybe(e.target.checked);
            setPreview(null);
          }}
          className="h-3.5 w-3.5 accent-[#c9a227]"
        />
        Include &quot;maybe&quot; addresses (Gmail, Yahoo, generic info@, etc.)
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!rawText.trim() || reviewing}
          onClick={() => void onReview()}
          className="font-mono text-[13px] border-[#c9a227]/40 text-[#e8c547] hover:bg-[#c9a227]/10"
        >
          {reviewing ? 'reviewing…' : 'review list'}
        </Button>
        <Button
          type="button"
          disabled={!summary || summary.readyToSend === 0 || sending}
          onClick={() => void onSend()}
          className="font-mono text-[13px] bg-[#c9a227]/90 text-black hover:bg-[#e8c547]"
        >
          {sending
            ? 'sending…'
            : summary
              ? `send invite (${summary.readyToSend})`
              : 'send invite'}
        </Button>
      </div>

      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ['total', summary.total, 'text-slate-300'],
              ['good', summary.good, 'text-emerald-300'],
              ['maybe', summary.maybe, 'text-amber-300'],
              ['bad', summary.bad, 'text-red-300'],
              ['already invited', summary.alreadyInvited, 'text-slate-400'],
              ['ready', summary.readyToSend, 'text-[#e8c547]'],
            ] as const
          ).map(([label, value, cls]) => (
            <div
              key={label}
              className="rounded-sm border border-white/5 bg-black/30 px-3 py-2"
            >
              <div className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                {label}
              </div>
              <div className={`font-mono text-lg ${cls}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md border border-white/10">
          <table className="w-full min-w-[640px] border-collapse font-mono text-[12px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-[#c9a227]/70">
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Quality</th>
                <th className="px-3 py-2 font-medium">Prior invite</th>
                <th className="px-3 py-2 font-medium">Send?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.email}
                  className="border-b border-white/[0.06] text-slate-300"
                >
                  <td className="px-3 py-2 text-slate-100">{row.email}</td>
                  <td className={`px-3 py-2 ${QUALITY_CLASS[row.quality]}`}>
                    {QUALITY_LABEL[row.quality]}
                    <span className="ml-2 text-[10px] text-slate-500">
                      {row.reason}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {row.alreadyInvited
                      ? row.lastInvitedAt
                        ? new Date(row.lastInvitedAt).toLocaleDateString()
                        : 'yes'
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {row.canSend ? (
                      <span className="text-emerald-300">yes</span>
                    ) : (
                      <span className="text-slate-500">no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
