'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { requestProvenanceValuation } from '~/app/artworks/[id]/_actions/request-provenance-valuation';

interface RequestValuationRowProps {
  artworkId: string;
  className?: string;
}

export function RequestValuationRow({ artworkId, className }: RequestValuationRowProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [llmUsed, setLlmUsed] = useState(false);

  const handleClick = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        console.log('[Valuation] editor submitting valuation', { artworkId });
        const result = await requestProvenanceValuation(artworkId);
        if (!result.success) {
          setError(result.error ?? 'Failed to generate valuation');
          return;
        }
        setLlmUsed(!!result.llmUsed);
        setMessage(
          result.llmUsed
            ? 'Valuation generated with LLM reasoning. View on the certificate.'
            : 'Valuation generated from structured data. View on the certificate.',
        );
      } catch (err) {
        console.error('[Valuation] editor submit failed', err);
        setError((err as Error).message ?? 'Failed to generate valuation');
      }
    });
  };

  return (
    <div
      className={cn(
        'rounded-md border border-wine/20 bg-wine/[0.03] p-3 space-y-2.5',
        className,
      )}
    >
      <div>
        <p className="text-xs font-serif font-medium text-ink/80 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-ink/60" />
          Provenance Valuation
        </p>
        <p className="text-[10px] text-ink/50 font-serif mt-0.5 leading-snug">
          Runs the deterministic scorer over provenance, exhibition and sales data.
          Submits to the LLM reasoning pass when configured.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={handleClick}
        className="font-serif text-xs h-8 w-full bg-ink text-parchment hover:bg-ink/90 whitespace-nowrap disabled:opacity-60"
      >
        {isPending ? 'Generating valuation…' : 'Submit Provenance Valuation'}
      </Button>
      {message ? (
        <p className="text-[11px] text-ink/70 font-serif">
          {message}{' '}
          <Link
            href={`/artworks/${artworkId}/certificate`}
            className="underline underline-offset-2 text-wine"
          >
            View certificate
          </Link>
          {llmUsed ? <span className="text-ink/50"> · LLM used</span> : null}
        </p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-red-700 font-serif">{error}</p>
      ) : null}
    </div>
  );
}
