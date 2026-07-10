'use client';

import { useState, useTransition } from 'react';
import { Sparkles, TrendingUp, ChevronDown, ChevronUp, Globe } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Switch } from '@kit/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@kit/ui/sheet';
import { cn } from '@kit/ui/utils';

import {
  requestProvenanceValuation,
  setValuationPublic,
} from '~/app/artworks/[id]/_actions/request-provenance-valuation';

export interface ProvenanceValuation {
  id: string;
  artwork_id: string;
  generated_at: string;
  engine_version: string;
  llm_model: string | null;
  estimated_value_cents: number | null;
  confidence_low_cents: number | null;
  confidence_high_cents: number | null;
  cultural_importance_score: number | null;
  liquidity_score: number | null;
  forgery_risk_score: number | null;
  rarity_index: number | null;
  former_owners_count: number | null;
  notable_collectors_count: number | null;
  museum_count: number | null;
  exhibition_count: number | null;
  scholarly_citations_count: number | null;
  artist_market_cap_cents: number | null;
  auction_history_summary: Record<string, unknown> | null;
  market_signals: Record<string, unknown> | null;
  narrative: string | null;
  is_public: boolean;
}

interface ProvenanceValuationBlockProps {
  artworkId: string;
  valuation: ProvenanceValuation | null;
  isOwner: boolean;
  canRequest: boolean;
  /** Compact display — no "Submit Valuation" button, read-only. Used on the public certificate face. */
  variant?: 'certificate' | 'panel';
  className?: string;
}

function formatMoney(cents: number | null | undefined, currency = 'USD'): string {
  if (!cents) return `${currency} 0`;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString()}`;
  }
}

interface WebResearchData {
  articles?: Array<{ title: string; url: string; source?: string | null; year?: string | null }>;
  auction_signals?: Array<{
    description: string;
    price_range?: string | null;
    house?: string | null;
    year?: string | null;
    url?: string | null;
  }>;
  museum_mentions?: Array<{
    institution: string;
    context?: string | null;
    url?: string | null;
  }>;
  representation?: string[];
  recognition?: string[];
  summary?: string | null;
}

function getWebResearch(marketSignals: Record<string, unknown> | null | undefined): WebResearchData | null {
  const raw = marketSignals?.web_research;
  if (!raw || typeof raw !== 'object') return null;
  return raw as WebResearchData;
}

function hasWebResearchSignals(webResearch: WebResearchData | null): boolean {
  if (!webResearch) return false;
  return (
    (webResearch.articles?.length ?? 0) > 0 ||
    (webResearch.auction_signals?.length ?? 0) > 0 ||
    (webResearch.museum_mentions?.length ?? 0) > 0 ||
    (webResearch.representation?.length ?? 0) > 0 ||
    (webResearch.recognition?.length ?? 0) > 0 ||
    !!webResearch.summary
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function ScorePill({ label, value, tone }: { label: string; value: number | null; tone: 'good' | 'warn' | 'neutral' }) {
  const displayValue = value == null ? '—' : Math.round(value);
  const toneClass =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : tone === 'warn'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-parchment/80 text-ink border-wine/20';
  return (
    <div className={cn('rounded-md border px-3 py-2 flex-1 min-w-[120px]', toneClass)}>
      <p className="text-[10px] uppercase tracking-wide font-serif opacity-70">{label}</p>
      <p className="font-serif text-lg">{displayValue}{value == null ? '' : '/100'}</p>
    </div>
  );
}

export function ProvenanceValuationBlock({
  artworkId,
  valuation,
  isOwner,
  canRequest,
  variant = 'certificate',
  className,
}: ProvenanceValuationBlockProps) {
  const [open, setOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [localPublic, setLocalPublic] = useState(valuation?.is_public ?? false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ProvenanceValuation | null>(valuation);

  const handleRequest = () => {
    setRequestError(null);
    startTransition(async () => {
      try {
        console.log('[Valuation] UI requesting valuation', { artworkId });
        const result = await requestProvenanceValuation(artworkId);
        if (!result.success) {
          setRequestError(result.error || 'Failed to generate valuation');
          return;
        }
        console.log('[Valuation] UI valuation generated', { artworkId, llmUsed: result.llmUsed });
        setOpen(true);
      } catch (err) {
        console.error('[Valuation] UI request failed', err);
        setRequestError((err as Error).message || 'Failed to generate valuation');
      }
    });
  };

  const handleTogglePublic = async (next: boolean) => {
    if (!current) return;
    setTogglingPublic(true);
    setLocalPublic(next);
    try {
      const res = await setValuationPublic(current.id, next);
      if (!res.success) {
        setLocalPublic(!next);
        setRequestError(res.error ?? 'Could not update visibility');
      } else {
        setCurrent({ ...current, is_public: next });
      }
    } finally {
      setTogglingPublic(false);
    }
  };

  const headline = current?.estimated_value_cents
    ? formatMoney(current.estimated_value_cents)
    : null;

  const rangeLabel =
    current?.confidence_low_cents != null && current?.confidence_high_cents != null
      ? `${formatMoney(current.confidence_low_cents)} – ${formatMoney(current.confidence_high_cents)}`
      : null;

  const webResearch = getWebResearch(current?.market_signals ?? null);
  const includesWebResearch = hasWebResearchSignals(webResearch);

  return (
    <section
      className={cn(
        'rounded-lg border border-wine/20 bg-parchment/60 p-4 sm:p-5',
        variant === 'certificate' ? '' : 'shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink/50 font-serif flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Provenance Valuation
            {current?.engine_version ? (
              <span className="ml-1 text-ink/40">{current.engine_version}</span>
            ) : null}
          </p>
          <h3 className="font-serif text-xl sm:text-2xl text-ink mt-0.5">
            {headline ?? (current ? 'Not enough data yet' : 'No valuation yet')}
          </h3>
          {rangeLabel ? (
            <p className="text-xs font-serif text-ink/60 mt-0.5">
              Confidence range: {rangeLabel}
            </p>
          ) : null}
          {current?.generated_at ? (
            <p className="text-[10px] text-ink/40 font-serif mt-0.5">
              Generated {formatDate(current.generated_at)}
              {current.llm_model ? ` · LLM reasoning: ${current.llm_model}` : ' · deterministic'}
              {includesWebResearch ? ' · Includes web research' : ''}
            </p>
          ) : null}
        </div>
        {canRequest ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRequest}
            disabled={isPending}
            className="font-serif whitespace-nowrap"
          >
            {isPending ? 'Generating…' : current ? 'Refresh valuation' : 'Submit valuation'}
          </Button>
        ) : null}
      </div>

      {requestError ? (
        <p className="mt-2 text-[11px] text-red-700 font-serif">{requestError}</p>
      ) : null}

      {current ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <ScorePill label="Cultural" value={current.cultural_importance_score} tone="good" />
            <ScorePill label="Liquidity" value={current.liquidity_score} tone="neutral" />
            <ScorePill label="Forgery risk" value={current.forgery_risk_score} tone="warn" />
            <ScorePill label="Rarity" value={current.rarity_index} tone="neutral" />
          </div>

          <button
            type="button"
            onClick={() => setBreakdownOpen((v) => !v)}
            className="mt-3 text-[11px] font-serif text-wine inline-flex items-center gap-1 underline underline-offset-4"
          >
            {breakdownOpen ? 'Hide breakdown' : 'Show breakdown'}
            {breakdownOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {breakdownOpen ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-serif text-ink/80">
              <BreakdownSection
                title="Provenance"
                items={[
                  { label: 'Former owners', value: String(current.former_owners_count ?? 0) },
                  { label: 'Notable collectors', value: String(current.notable_collectors_count ?? 0) },
                  { label: 'Museum presence', value: String(current.museum_count ?? 0) },
                ]}
              />
              <BreakdownSection
                title="Exhibition & publication"
                items={[
                  { label: 'Exhibitions', value: String(current.exhibition_count ?? 0) },
                  { label: 'Scholarly citations', value: String(current.scholarly_citations_count ?? 0) },
                ]}
              />
              <BreakdownSection
                title="Artist"
                items={[
                  { label: 'Artist market cap', value: formatMoney(current.artist_market_cap_cents ?? 0) },
                  {
                    label: 'Auction range',
                    value: (() => {
                      const summary = current.auction_history_summary || {};
                      const low = Number(summary.low_cents ?? 0);
                      const high = Number(summary.high_cents ?? 0);
                      if (!low && !high) return '—';
                      return `${formatMoney(low)} – ${formatMoney(high)}`;
                    })(),
                  },
                ]}
              />
              <BreakdownSection
                title="Market signals"
                items={[
                  {
                    label: 'Comparables',
                    value: String(current.market_signals?.same_medium_count ?? 0),
                  },
                  {
                    label: 'Avg comparable',
                    value: formatMoney(Number(current.market_signals?.avg_comparable_cents ?? 0)),
                  },
                ]}
              />
              {includesWebResearch && webResearch ? (
                <ExternalResearchSection webResearch={webResearch} />
              ) : null}
            </div>
          ) : null}

          {current.narrative ? (
            <blockquote className="mt-3 border-l-2 border-wine/40 pl-3 text-xs sm:text-sm font-serif text-ink/80 italic">
              {current.narrative}
            </blockquote>
          ) : null}

          {isOwner ? (
            <div className="mt-3 flex items-center gap-2 text-[11px] font-serif text-ink/60">
              <Switch
                checked={localPublic}
                onCheckedChange={handleTogglePublic}
                disabled={togglingPublic}
                aria-label="Make valuation public"
              />
              <span>
                {localPublic
                  ? 'Public on certificate'
                  : 'Private — only visible to you'}
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs font-serif text-ink/60">
          {canRequest
            ? 'Submit a Provenance Valuation to compute an estimated value, cultural importance, liquidity, and forgery risk from this work\u2019s structured data.'
            : 'The owner has not published a Provenance Valuation for this work yet.'}
        </p>
      )}

      {variant === 'panel' ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <span className="sr-only">Open valuation details</span>
          </SheetTrigger>
          <SheetContent side="right" className="max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-serif">Provenance Valuation</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3 text-sm font-serif">
              <p className="text-xs text-ink/60">
                Generated {formatDate(current?.generated_at)} · engine {current?.engine_version}
              </p>
              {current?.narrative ? <p>{current.narrative}</p> : null}
              <div className="flex flex-wrap gap-2">
                <ScorePill label="Cultural" value={current?.cultural_importance_score ?? null} tone="good" />
                <ScorePill label="Liquidity" value={current?.liquidity_score ?? null} tone="neutral" />
                <ScorePill label="Forgery risk" value={current?.forgery_risk_score ?? null} tone="warn" />
                <ScorePill label="Rarity" value={current?.rarity_index ?? null} tone="neutral" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  );
}

function BreakdownSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-md border border-wine/15 bg-parchment/80 p-3">
      <p className="text-[10px] uppercase tracking-wide text-ink/50 font-serif flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3" />
        {title}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2">
            <span className="text-ink/60">{item.label}</span>
            <span className="text-ink font-medium">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExternalResearchSection({ webResearch }: { webResearch: WebResearchData }) {
  return (
    <div className="rounded-md border border-wine/15 bg-parchment/80 p-3 sm:col-span-2">
      <p className="text-[10px] uppercase tracking-wide text-ink/50 font-serif flex items-center gap-1.5">
        <Globe className="h-3 w-3" />
        External research
      </p>

      {webResearch.summary ? (
        <p className="mt-2 text-xs text-ink/75 leading-snug">{webResearch.summary}</p>
      ) : null}

      {webResearch.articles && webResearch.articles.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-ink/45 font-serif">Press & articles</p>
          <ul className="mt-1 space-y-1.5">
            {webResearch.articles.map((article) => (
              <li key={article.url}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-wine underline underline-offset-2 hover:text-wine/80"
                >
                  {article.title}
                </a>
                <span className="text-ink/50">
                  {article.source ? ` · ${article.source}` : ''}
                  {article.year ? ` · ${article.year}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {webResearch.museum_mentions && webResearch.museum_mentions.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-ink/45 font-serif">Museums</p>
          <ul className="mt-1 space-y-1">
            {webResearch.museum_mentions.map((mention) => (
              <li key={`${mention.institution}-${mention.context ?? ''}`} className="text-ink/75">
                {mention.url ? (
                  <a
                    href={mention.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-wine underline underline-offset-2"
                  >
                    {mention.institution}
                  </a>
                ) : (
                  mention.institution
                )}
                {mention.context ? ` — ${mention.context}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {webResearch.auction_signals && webResearch.auction_signals.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-ink/45 font-serif">Auction signals</p>
          <ul className="mt-1 space-y-1">
            {webResearch.auction_signals.map((signal) => (
              <li key={`${signal.description}-${signal.year ?? ''}`} className="text-ink/75">
                {signal.description}
                {signal.price_range ? ` · ${signal.price_range}` : ''}
                {signal.house ? ` · ${signal.house}` : ''}
                {signal.year ? ` · ${signal.year}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(webResearch.representation?.length ?? 0) > 0 ? (
        <p className="mt-3 text-xs text-ink/70">
          <span className="text-ink/50">Representation: </span>
          {webResearch.representation!.join(', ')}
        </p>
      ) : null}

      {(webResearch.recognition?.length ?? 0) > 0 ? (
        <p className="mt-2 text-xs text-ink/70">
          <span className="text-ink/50">Recognition: </span>
          {webResearch.recognition!.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
