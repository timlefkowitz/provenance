'use client';

import Link from 'next/link';
import { ArrowLeft, GraduationCap, Layout, Tag, Newspaper, CheckCircle2 } from 'lucide-react';
import type { ArtistCvJson } from '~/lib/grants';
import type { CvExhibitionRow } from '../cv/_helpers/merge-exhibitions';
import { CvUploadPanel } from './cv-upload-panel';
import type { NewsPublication } from '~/app/profiles/_actions/get-user-profiles';

type Props = {
  artistId: string;
  displayName: string;
  medium: string | null;
  location: string | null;
  cvJson: ArtistCvJson;
  uploadedAt: string | null;
  mergedExhibitions: CvExhibitionRow[];
  newsPublications: NewsPublication[];
  /** Owner-only props — omit for visitors */
  isOwner?: boolean;
  profileId?: string;
  hasOriginalFile?: boolean;
};

export function ArtistCvView({
  artistId,
  displayName,
  medium,
  location,
  cvJson,
  uploadedAt,
  mergedExhibitions,
  newsPublications,
  isOwner = false,
  profileId,
  hasOriginalFile = false,
}: Props) {
  const education = cvJson.education ?? [];
  const disciplines = cvJson.disciplines ?? [];
  const summary = cvJson.summary ?? null;

  return (
    <div className="min-h-screen">
      {/* ── TOP BAR ── */}
      <div className="border-b border-wine/15 bg-parchment/50">
        <div className="container mx-auto px-4 max-w-4xl py-4 flex items-center justify-between gap-4">
          <Link
            href={`/artists/${artistId}`}
            className="inline-flex items-center gap-1.5 text-sm font-serif text-wine/70 hover:text-wine transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to profile
          </Link>
          {uploadedAt && (
            <p className="text-[11px] font-serif text-ink/40 hidden sm:block">
              CV last updated{' '}
              {new Date(uploadedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="container mx-auto px-4 max-w-4xl py-10 md:py-14 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 lg:gap-16 items-start">

          {/* ── MAIN CV COLUMN ── */}
          <article className="min-w-0 space-y-12">

            {/* Header */}
            <header>
              <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">
                {medium || 'Artist'}
              </p>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-ink leading-tight tracking-tight mb-2">
                {displayName}
              </h1>
              {(location || cvJson.location) && (
                <p className="font-serif text-sm text-ink/55">
                  {cvJson.location || location}
                </p>
              )}
            </header>

            {/* Summary */}
            {summary && (
              <section>
                <CvSectionHeading>Statement</CvSectionHeading>
                <p className="font-serif text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">
                  {summary}
                </p>
              </section>
            )}

            {/* Exhibitions */}
            {mergedExhibitions.length > 0 && (
              <section>
                <CvSectionHeading icon={<Layout className="h-3.5 w-3.5" />}>
                  Exhibitions
                </CvSectionHeading>
                <ul className="space-y-3">
                  {mergedExhibitions.map((ex, i) => (
                    <li key={i} className="flex items-start gap-3 group">
                      <span className="font-serif text-xs text-ink/40 w-10 flex-shrink-0 pt-0.5 text-right tabular-nums">
                        {ex.year}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {ex.source === 'provenance' && ex.exhibitionId ? (
                            <Link
                              href={`/exhibitions/${ex.exhibitionId}`}
                              className="font-serif text-sm font-medium text-ink hover:text-wine transition-colors"
                            >
                              {ex.name}
                            </Link>
                          ) : (
                            <span className="font-serif text-sm font-medium text-ink">
                              {ex.name}
                            </span>
                          )}
                          {ex.source === 'provenance' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-wine/25 bg-wine/6 px-1.5 py-0.5 text-[9px] font-serif uppercase tracking-wider text-wine/70 flex-shrink-0">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Provenance
                            </span>
                          )}
                        </div>
                        {ex.venue && (
                          <p className="font-serif text-xs text-ink/50 mt-0.5">{ex.venue}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Education */}
            {education.length > 0 && (
              <section>
                <CvSectionHeading icon={<GraduationCap className="h-3.5 w-3.5" />}>
                  Education
                </CvSectionHeading>
                <ul className="space-y-3">
                  {education.map((ed, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="font-serif text-xs text-ink/40 w-10 flex-shrink-0 pt-0.5 text-right tabular-nums">
                        {ed.year}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-sm font-medium text-ink">{ed.institution}</p>
                        {ed.degree && (
                          <p className="font-serif text-xs text-ink/55 mt-0.5">{ed.degree}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Disciplines */}
            {disciplines.length > 0 && (
              <section>
                <CvSectionHeading icon={<Tag className="h-3.5 w-3.5" />}>
                  Disciplines
                </CvSectionHeading>
                <div className="flex flex-wrap gap-2">
                  {disciplines.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-wine/20 bg-wine/5 px-3 py-1 text-xs font-serif text-ink/70"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Press */}
            {newsPublications.length > 0 && (
              <section>
                <CvSectionHeading icon={<Newspaper className="h-3.5 w-3.5" />}>
                  Press
                </CvSectionHeading>
                <ul className="space-y-4">
                  {newsPublications.map((pub, i) => (
                    <li key={i}>
                      <a
                        href={pub.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-serif text-sm font-medium text-wine/90 hover:text-wine hover:underline block leading-snug"
                      >
                        {pub.title}
                      </a>
                      {(pub.publication_name || pub.date) && (
                        <p className="font-serif text-xs text-ink/45 mt-0.5">
                          {[pub.publication_name, pub.date].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          {/* ── SIDEBAR (owner only) ── */}
          {isOwner && profileId && (
            <aside className="lg:sticky lg:top-8">
              <CvUploadPanel
                profileId={profileId}
                hasExistingFile={hasOriginalFile}
                uploadedAt={uploadedAt}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function CvSectionHeading({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-5 pb-2 border-b border-wine/10">
      {icon && <span className="text-wine/50">{icon}</span>}
      <h2 className="text-[10px] uppercase tracking-widest text-ink/40 font-serif">{children}</h2>
    </div>
  );
}
