'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from 'sonner';

import { importLeadRowsToContacts } from '../../contacts/_actions/admin-contacts';
import { LeadInviteOutreachPanel } from './lead-invite-outreach-panel';

type LeadRow = {
  title: string;
  subtitle: string;
  url?: string;
  email?: string;
  emails: string[];
  phone?: string;
  address?: string;
};

type RunRow = {
  id: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  defaultDatasetId?: string;
};

type LeadsPayload = {
  actorId: string;
  defaultActorId: string;
  runs: RunRow[];
  runId: string | null;
  runStatus: string | null;
  datasetId: string | null;
  leads: LeadRow[];
  message: string | null;
  error?: string;
};

const TERMINAL_STATUSES = new Set([
  'SUCCEEDED',
  'FAILED',
  'TIMED-OUT',
  'ABORTED',
]);

export function AdminLeadsPanel() {
  const router = useRouter();
  const [importPending, setImportPending] = useState(false);
  const [runId, setRunId] = useState<string>('');
  const [data, setData] = useState<LeadsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // New-run form state
  const [searchTerms, setSearchTerms] = useState('art galleries');
  const [location, setLocation] = useState('New York, USA');
  const [maxResults, setMaxResults] = useState(25);
  const [starting, setStarting] = useState(false);

  // View state
  const [emailsOnly, setEmailsOnly] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (overrideRunId?: string) => {
      setLoading(true);
      setErr(null);
      try {
        const id = overrideRunId ?? runId;
        const q = id ? `?runId=${encodeURIComponent(id)}` : '';
        const res = await fetch(`/api/admin/leads${q}`, {
          credentials: 'same-origin',
        });
        const json = (await res.json()) as LeadsPayload & { error?: string };
        if (!res.ok) {
          setErr(json.error || `Request failed (${res.status})`);
          setData(null);
          return;
        }
        setData(json);
      } catch (e) {
        console.error('[AdminLeadsPanel] fetch failed', e);
        setErr(e instanceof Error ? e.message : 'Failed to load');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [runId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-poll while a run is in progress
  useEffect(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    const status = data?.runStatus;
    if (status && !TERMINAL_STATUSES.has(status)) {
      pollTimer.current = setTimeout(() => {
        void load();
      }, 5000);
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [data?.runStatus, load]);

  const startRun = useCallback(async () => {
    const terms = searchTerms
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (terms.length === 0) {
      setErr('Add at least one search term (e.g. "art galleries").');
      return;
    }
    setStarting(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: terms,
          location: location.trim() || undefined,
          maxResults,
        }),
      });
      const json = (await res.json()) as { runId?: string; error?: string };
      if (!res.ok || !json.runId) {
        setErr(json.error || `Failed to start run (${res.status})`);
        return;
      }
      setRunId(json.runId);
      await load(json.runId);
    } catch (e) {
      console.error('[AdminLeadsPanel] startRun failed', e);
      setErr(e instanceof Error ? e.message : 'Failed to start run');
    } finally {
      setStarting(false);
    }
  }, [searchTerms, location, maxResults, load]);

  const allEmails = useMemo(() => {
    const set = new Set<string>();
    (data?.leads ?? []).forEach((l) => l.emails.forEach((e) => set.add(e)));
    return Array.from(set);
  }, [data?.leads]);

  const visibleLeads = useMemo(() => {
    if (!data) return [];
    return emailsOnly
      ? data.leads.filter((l) => l.emails.length > 0)
      : data.leads;
  }, [data, emailsOnly]);

  const copy = useCallback(
    async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
      } catch (e) {
        console.error('[AdminLeadsPanel] copy failed', e);
      }
    },
    [],
  );

  const downloadCsv = useCallback(() => {
    if (!data || data.leads.length === 0) return;
    const escape = (v: string) =>
      `"${(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const header = ['name', 'emails', 'phone', 'website', 'address'].join(',');
    const rows = data.leads.map((l) =>
      [
        escape(l.title),
        escape(l.emails.join('; ')),
        escape(l.phone ?? ''),
        escape(l.url ?? ''),
        escape(l.address ?? ''),
      ].join(','),
    );
    const blob = new Blob([`${header}\n${rows.join('\n')}\n`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${data.datasetId ?? 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [data]);

  const consoleHref = data?.actorId
    ? `https://console.apify.com/actors/${encodeURIComponent(data.actorId)}`
    : 'https://console.apify.com/actors/poidata~google-maps-email-extractor';

  const isRunning =
    !!data?.runStatus && !TERMINAL_STATUSES.has(data.runStatus);

  async function onImportLeadsToContacts() {
    const leads = visibleLeads;
    if (leads.length === 0) return;
    setImportPending(true);
    console.log('[AdminLeadsPanel] import to contacts', { n: leads.length });
    try {
      const r = await importLeadRowsToContacts(
        leads.map((l) => ({
          title: l.title,
          email: l.emails[0],
          phone: l.phone,
          url: l.url,
          address: l.address,
        })),
      );
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Imported ${r.inserted} contact(s); skipped ${r.skipped} with no usable fields.`,
      );
      router.refresh();
    } finally {
      setImportPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <LeadInviteOutreachPanel />

      {/* New search */}
      <section className="rounded-md border border-[#1793d1]/25 bg-black/30 p-4">
        <h2 className="mb-3 font-mono text-[12px] uppercase tracking-wide text-[#67d4ff]">
          new search
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <label className="sm:col-span-6">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[#1793d1]/80">
              Search terms (comma-separated)
            </span>
            <input
              value={searchTerms}
              onChange={(e) => setSearchTerms(e.target.value)}
              placeholder="art galleries, museums"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </label>
          <label className="sm:col-span-4">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[#1793d1]/80">
              Location
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="New York, USA"
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[#1793d1]/80">
              Max
            </span>
            <input
              type="number"
              min={1}
              max={200}
              value={maxResults}
              onChange={(e) =>
                setMaxResults(Math.max(1, Math.min(200, Number(e.target.value) || 25)))
              }
              className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void startRun()}
            disabled={starting || isRunning}
            className="font-mono text-[13px]"
          >
            {starting
              ? 'starting…'
              : isRunning
                ? 'run in progress…'
                : 'start run'}
          </Button>
          <p className="font-mono text-[11px] text-slate-500">
            Queues an Apify run on{' '}
            <span className="text-slate-300">{data?.actorId ?? 'poidata~google-maps-email-extractor'}</span>.
            Auto-refreshes every 5s while running.
          </p>
        </div>
      </section>

      {/* Run picker + refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl flex-1">
          <label
            htmlFor="apify-run"
            className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[#1793d1]/80"
          >
            View run
          </label>
          <select
            id="apify-run"
            className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-slate-200 outline-none focus:border-[#1793d1]/50"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
          >
            <option value="">Latest successful run (default)</option>
            {(data?.runs ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.slice(0, 8)}… · {r.status}
                {r.defaultDatasetId ? '' : ' · no dataset'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={visibleLeads.length === 0 || importPending}
            onClick={() => void onImportLeadsToContacts()}
            className="font-mono text-[13px] border-emerald-500/30 text-emerald-200/90 hover:bg-emerald-500/10"
          >
            {importPending ? 'importing…' : 'add visible leads → contacts'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            className="font-mono text-[13px] border-[#1793d1]/40 text-[#67d4ff] hover:bg-[#1793d1]/15"
          >
            {loading ? 'loading…' : 'refresh'}
          </Button>
        </div>
      </div>

      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300">
          {err}
        </p>
      )}

      {data && (
        <div className="rounded-md border border-white/10 bg-black/20 p-4 font-mono text-[12px] text-slate-400">
          <p className="text-slate-300">
            <span className="text-[#1793d1]/70">actor</span>{' '}
            <span className="text-slate-200">{data.actorId}</span>
            {data.actorId === data.defaultActorId && (
              <span className="ml-2 text-slate-500">
                (default: Google Maps Email Extractor)
              </span>
            )}
          </p>
          <p className="mt-1">
            <span className="text-[#1793d1]/70">run</span>{' '}
            <span className="text-slate-300">
              {data.runId ? `${data.runId.slice(0, 8)}…` : '—'}
            </span>
            {data.runStatus && (
              <span
                className={`ml-2 ${
                  data.runStatus === 'SUCCEEDED'
                    ? 'text-emerald-300'
                    : isRunning
                      ? 'text-amber-300'
                      : 'text-red-300'
                }`}
              >
                {data.runStatus.toLowerCase()}
                {isRunning && ' · polling'}
              </span>
            )}
          </p>
          <p className="mt-1">
            <span className="text-[#1793d1]/70">dataset</span>{' '}
            {data.datasetId || '—'}
          </p>
          <a
            href={consoleHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[#67d4ff] underline-offset-2 hover:underline"
          >
            Open in Apify Console →
          </a>
        </div>
      )}

      {data?.message && (
        <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-4 py-3 font-serif text-sm text-amber-100/90">
          {data.message}
        </p>
      )}

      {data && data.leads.length > 0 && (
        <>
          {/* Email list summary + actions */}
          <section className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono text-[12px] uppercase tracking-wide text-emerald-300">
                emails extracted ({allEmails.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={allEmails.length === 0}
                  onClick={() =>
                    void copy('all-emails', allEmails.join('\n'))
                  }
                  className="font-mono text-[12px] border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                >
                  {copied === 'all-emails' ? 'copied!' : 'copy all'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={allEmails.length === 0}
                  onClick={() =>
                    void copy('all-emails-comma', allEmails.join(', '))
                  }
                  className="font-mono text-[12px] border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                >
                  {copied === 'all-emails-comma' ? 'copied!' : 'copy comma-list'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadCsv}
                  className="font-mono text-[12px] border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                >
                  download csv
                </Button>
              </div>
            </div>
            {allEmails.length > 0 ? (
              <ul className="mt-3 max-h-56 overflow-y-auto rounded-sm border border-white/5 bg-black/30 p-3 font-mono text-[12px] text-slate-200">
                {allEmails.map((e) => (
                  <li key={e} className="py-0.5 leading-snug">
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 font-mono text-[12px] text-slate-500">
                No emails were found in this run&apos;s results yet.
              </p>
            )}
          </section>

          {/* Filter toggle */}
          <div className="flex items-center justify-between">
            <p className="font-mono text-[12px] text-slate-500">
              {visibleLeads.length} of {data.leads.length} places shown
            </p>
            <label className="flex cursor-pointer items-center gap-2 font-mono text-[12px] text-slate-400">
              <input
                type="checkbox"
                checked={emailsOnly}
                onChange={(e) => setEmailsOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#1793d1]"
              />
              only show places with emails
            </label>
          </div>

          {/* Detailed leads table */}
          <div className="overflow-x-auto rounded-md border border-white/10">
            <table className="w-full min-w-[720px] border-collapse font-mono text-[13px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-[#1793d1]/70">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Emails</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Web</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((lead, i) => (
                  <tr
                    key={`${lead.title}-${i}`}
                    className="border-b border-white/[0.06] text-slate-300 hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-100">
                        {lead.title}
                      </div>
                      {lead.address && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {lead.address}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-[12px]">
                      {lead.emails.length === 0 ? (
                        <span className="text-slate-600">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {lead.emails.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => void copy(`em-${i}-${e}`, e)}
                              className="text-left text-emerald-200 hover:text-emerald-100"
                              title="Click to copy"
                            >
                              {copied === `em-${i}-${e}` ? `${e} ✓` : e}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-[12px] text-slate-400">
                      {lead.phone ?? '—'}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {lead.url ? (
                        <a
                          href={
                            lead.url.startsWith('http')
                              ? lead.url
                              : `https://${lead.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-[#67d4ff] underline-offset-2 hover:underline"
                        >
                          {lead.url}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
