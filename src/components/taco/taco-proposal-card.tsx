'use client';

/* eslint-disable @next/next/no-img-element -- staged Supabase images, sized by CSS */

import { useState, useTransition } from 'react';

import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Send,
  Sparkles,
} from 'lucide-react';

import { applyTacoProposal, skipTacoProposal } from '~/app/taco/_actions/apply-taco-proposal';
import type { ProposalKind, ProposalResult, ProposalStatus, TacoProposalView } from '~/lib/taco/proposals';

const KIND_ICON: Record<ProposalKind, typeof Plus> = {
  create_artworks: Plus,
  add_photo: ImagePlus,
  attach_document: FileText,
  update_provenance: Sparkles,
  add_to_exhibition: Plus,
  add_publication: FileText,
  record_sale: Receipt,
  provenance_request: Send,
};

type Props = {
  proposal: TacoProposalView;
  compact?: boolean;
  /** Called once the user applies or skips, with a line for Taco's history. */
  onResolved?: (note: string, view: TacoProposalView) => void;
  onNavigate?: (href: string) => void;
};

export function TacoProposalCard({ proposal, compact = false, onResolved, onNavigate }: Props) {
  const { preview, kind } = proposal;
  const [status, setStatus] = useState<ProposalStatus>(proposal.status);
  const [result, setResult] = useState<ProposalResult | null>(proposal.result ?? null);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(preview.changes.map((c) => [c.key, c.after])),
  );
  const rows = preview.rows ?? [];
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(rows.flatMap((r, i) => (r.match ? [] : [i]))),
  );
  const [rowTitles, setRowTitles] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const Icon = KIND_ICON[kind] ?? Sparkles;
  const done = status !== 'pending';
  const hasEditable = preview.changes.some((c) => c.editable) || rows.length > 0;

  const apply = () =>
    startTransition(async () => {
      const editedFields = Object.fromEntries(
        preview.changes.filter((c) => c.editable && fields[c.key] !== c.after).map((c) => [c.key, fields[c.key] ?? '']),
      );
      const r = await applyTacoProposal(proposal.id, {
        fields: editedFields,
        selectedRows: rows.length ? [...selected].sort((a, b) => a - b) : undefined,
        rowTitles,
      });
      setStatus(r.status);
      setResult(r.result);
      if (r.status === 'applied' || r.status === 'partial') {
        setEditing(false);
        onResolved?.(`[Applied: ${preview.title} — ${r.result.message}]`, { ...proposal, status: r.status, result: r.result });
      }
    });

  const skip = () =>
    startTransition(async () => {
      const r = await skipTacoProposal(proposal.id);
      setStatus(r.status);
      if (r.status === 'skipped') onResolved?.(`[Skipped: ${preview.title}]`, { ...proposal, status: 'skipped' });
    });

  const text = compact ? 'text-[12px]' : 'text-[13px]';

  return (
    <div
      className={`w-full rounded-xl border bg-white shadow-xs ${
        done && status !== 'failed' ? 'border-emerald-300/60' : 'border-wine/25'
      } ${compact ? 'p-2.5' : 'p-3.5'}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        {preview.artwork?.image_url ? (
          <img
            src={preview.artwork.image_url}
            alt=""
            className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} shrink-0 rounded-md object-cover ring-1 ring-wine/10`}
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wine/10 text-wine">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`font-display ${compact ? 'text-[13px]' : 'text-sm'} leading-snug text-wine`}>{preview.title}</p>
          {preview.summary && <p className={`mt-0.5 font-serif ${compact ? 'text-[11px]' : 'text-xs'} text-ink/55`}>{preview.summary}</p>}
        </div>
      </div>

      {/* Files */}
      {preview.attachments && preview.attachments.length > 0 && kind !== 'create_artworks' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {preview.attachments.map((a) =>
            a.kind === 'image' ? (
              <img key={a.url} src={a.url} alt={a.name} className="h-14 w-14 rounded-md object-cover ring-1 ring-wine/10" />
            ) : (
              <span key={a.url} className="inline-flex items-center gap-1 rounded-md bg-wine/5 px-2 py-1 font-serif text-[11px] text-wine">
                <FileText className="h-3 w-3" />
                {a.name}
              </span>
            ),
          )}
        </div>
      )}

      {/* Field changes */}
      {preview.changes.length > 0 && (
        <dl className={`mt-2.5 space-y-2 font-serif ${text}`}>
          {preview.changes.map((c) => (
            <div key={c.key}>
              <dt className="text-[10px] uppercase tracking-wide text-ink/45">{c.label}</dt>
              {c.before && kind === 'update_provenance' && c.key.startsWith('set.') && (
                <dd className="text-ink/40 line-through decoration-ink/30">{c.before}</dd>
              )}
              {editing && c.editable ? (
                <textarea
                  value={fields[c.key] ?? ''}
                  onChange={(e) => setFields((f) => ({ ...f, [c.key]: e.target.value }))}
                  rows={Math.min(5, Math.max(1, (fields[c.key] ?? '').split('\n').length))}
                  className="mt-0.5 w-full resize-y rounded-md border border-wine/25 bg-parchment/40 px-2 py-1 text-base sm:text-[13px] text-ink focus:border-wine/50 focus:outline-none"
                />
              ) : (
                <dd className="whitespace-pre-line text-ink">
                  {c.key.startsWith('append.') && <span className="text-emerald-600">+ </span>}
                  {fields[c.key] || <span className="text-ink/35">—</span>}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}

      {/* Rows (create artworks) */}
      {rows.length > 0 && (
        <ul className={`mt-2.5 max-h-72 space-y-1.5 overflow-y-auto font-serif ${text}`}>
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md border border-wine/10 bg-parchment/30 p-1.5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--color-wine,#6b1d2a)]"
                checked={selected.has(i)}
                disabled={done || pending}
                onChange={(e) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    return next;
                  })
                }
                aria-label={`Include ${r.title}`}
              />
              {r.image_url && <img src={r.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                {editing ? (
                  <input
                    value={rowTitles[i] ?? r.title}
                    onChange={(e) => setRowTitles((t) => ({ ...t, [i]: e.target.value }))}
                    className="w-full rounded border border-wine/25 px-1.5 py-0.5 text-base sm:text-[13px]"
                  />
                ) : (
                  <p className="truncate text-ink">{rowTitles[i] ?? r.title}</p>
                )}
                <p className="truncate text-[11px] text-ink/50">
                  {[r.artist_name, r.year, r.medium, r.dimensions, r.value].filter(Boolean).join(' · ') || (r.image_url ? '' : 'Draft, no photo')}
                </p>
                {r.match && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.(`/artworks/${r.match!.artwork_id}`)}
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700 hover:underline"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {r.match.confidence === 'strong' ? 'Already on Provenance' : 'Looks like'}: {r.match.title}
                    {r.match.mine ? ' (yours)' : ''}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
                {result?.rowErrors?.[i] && <p className="text-[11px] text-red-600">{result.rowErrors[i]}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Result / error */}
      {result && (
        <p className={`mt-2 font-serif ${text} ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {result.ok && <Check className="mr-1 inline h-3.5 w-3.5" />}
          {result.message}
        </p>
      )}
      {status === 'skipped' && <p className={`mt-2 font-serif ${text} text-ink/45`}>Skipped. Nothing was changed.</p>}

      {/* Actions */}
      {!done ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={pending || (rows.length > 0 && selected.size === 0)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-wine px-3 font-serif text-[13px] text-parchment hover:bg-wine/90 disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {rows.length > 1 ? `${preview.apply_label} (${selected.size})` : preview.apply_label}
          </button>
          {hasEditable && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              disabled={pending}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-wine/25 px-2.5 font-serif text-[13px] text-wine hover:bg-wine/5"
            >
              <Pencil className="h-3.5 w-3.5" />
              {editing ? 'Done editing' : 'Edit'}
            </button>
          )}
          <button
            type="button"
            onClick={skip}
            disabled={pending}
            className="min-h-[36px] rounded-lg px-2.5 font-serif text-[13px] text-ink/50 hover:text-ink"
          >
            Skip
          </button>
        </div>
      ) : (
        result?.navigation &&
        result.navigation.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.navigation.map((n) => (
              <button
                key={n.href}
                type="button"
                onClick={() => onNavigate?.(n.href)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-wine/20 bg-wine/5 px-2.5 font-serif text-[12px] text-wine hover:bg-wine hover:text-parchment"
              >
                {n.label}
                <ExternalLink className="h-3 w-3" />
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
