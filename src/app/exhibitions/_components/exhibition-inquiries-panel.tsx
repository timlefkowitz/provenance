'use client';

import { useState } from 'react';
import Link from 'next/link';

import type { ExhibitionInquiry } from '../_actions/exhibition-inquiries';

const INITIAL = 5;

/** Organiser-only list of site inquiries about works in this show. */
export function ExhibitionInquiriesPanel({ inquiries }: { inquiries: ExhibitionInquiry[] }) {
  const [showAll, setShowAll] = useState(false);

  if (inquiries.length === 0) return null;

  const newCount = inquiries.filter((i) => i.status === 'pending').length;
  const list = showAll ? inquiries : inquiries.slice(0, INITIAL);

  return (
    <section
      id="inquiries"
      className="mb-8 rounded-lg border border-wine/15 bg-parchment/60 px-4 py-4 font-serif"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-[10px] uppercase tracking-widest text-ink/50">
          Inquiries
          {newCount > 0 && (
            <span className="ml-2 rounded-full bg-wine text-parchment px-2 py-0.5 text-[10px]">
              {newCount} new
            </span>
          )}
        </h2>
        {inquiries.length > INITIAL && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-wine underline underline-offset-4"
          >
            {showAll ? 'Show fewer' : `Show all (${inquiries.length})`}
          </button>
        )}
      </div>

      <ul className="divide-y divide-wine/10">
        {list.map((i) => (
          <li key={i.id} className="py-3 text-sm">
            <p className="text-ink">
              <span className="font-semibold">{i.name}</span>{' '}
              <span className="text-ink/50">
                {i.inquiry_type === 'purchase' ? 'bought' : 'asked about'}
              </span>{' '}
              <Link
                href={`/artworks/${i.artwork_id}/certificate`}
                className="text-wine underline-offset-4 hover:underline"
              >
                {i.artwork_title || 'Untitled'}
              </Link>
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink/55">
              <a href={`mailto:${i.email}`} className="hover:text-wine break-all">
                {i.email}
              </a>
              <span className="text-ink/35">
                {new Date(i.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </p>
            {i.message && (
              <p className="mt-1 text-xs text-ink/60 whitespace-pre-line">{i.message}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
