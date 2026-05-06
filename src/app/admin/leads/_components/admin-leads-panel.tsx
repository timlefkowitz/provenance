'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@kit/ui/button';

type LeadRow = {
  title: string;
  subtitle: string;
  url?: string;
  email?: string;
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
  datasetId: string | null;
  leads: LeadRow[];
  message: string | null;
  error?: string;
};

export function AdminLeadsPanel() {
  const [runId, setRunId] = useState<string>('');
  const [data, setData] = useState<LeadsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = runId ? `?runId=${encodeURIComponent(runId)}` : '';
      const res = await fetch(`/api/admin/leads${q}`, { credentials: 'same-origin' });
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
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const consoleHref = data?.actorId
    ? `https://console.apify.com/actors/${encodeURIComponent(data.actorId)}`
    : 'https://console.apify.com/actors/compass~crawler-google-places';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <label
            htmlFor="apify-run"
            className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[#1793d1]/80"
          >
            Run (optional)
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
              <span className="ml-2 text-slate-500">(default: Google Places)</span>
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
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full min-w-[640px] border-collapse font-mono text-[13px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-[#1793d1]/70">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Web</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((lead, i) => (
                <tr
                  key={`${lead.title}-${i}`}
                  className="border-b border-white/[0.06] text-slate-300 hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-slate-100">{lead.title}</div>
                    {lead.subtitle && (
                      <div className="mt-0.5 text-[11px] text-slate-500">{lead.subtitle}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-[12px]">
                    {lead.email && <div className="text-slate-300">{lead.email}</div>}
                    {lead.phone && <div className="text-slate-500">{lead.phone}</div>}
                    {!lead.email && !lead.phone && '—'}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {lead.url ? (
                      <a
                        href={lead.url.startsWith('http') ? lead.url : `https://${lead.url}`}
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
      )}
    </div>
  );
}
