'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, ChevronDown, ExternalLink, FileText, MapPin } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { StreakStar } from '~/components/streak-star';
import type { StarTier } from '~/lib/streak-service';
import { SocialLinkItem } from './social-link-item';
import { TacoAvatar } from '~/components/taco-avatar';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArtistTemplateProps {
  displayName: string;
  medium: string | null;
  location: string | null;
  bio: string | null;
  pictureUrl: string | null;
  memberSince: string | null;
  artworks: Array<{
    id: string;
    title: string;
    image_url: string | null;
    created_at: string;
    certificate_number: string;
  }>;
  exhibitions: Array<{
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
  }>;
  press: Array<{
    title: string;
    url: string;
    publication_name?: string;
    date?: string;
  }>;
  links: string[];
  website: string | null;
  isOwner: boolean;
  profileId?: string;
  publishedSiteUrl: string | null;
  hasCv: boolean;
  cvHref: string;
  streak?: {
    currentStreakDays: number;
    longestStreakDays: number;
    starTier: StarTier;
  };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function formatYear(iso: string) {
  return new Date(iso).getFullYear();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function exhibitionYear(start: string, end: string | null) {
  const y = formatYear(start);
  if (end) {
    const ye = formatYear(end);
    return y === ye ? y : `${y}–${ye}`;
  }
  return y;
}

function OwnerActions({
  isOwner,
  profileId,
  publishedSiteUrl,
  hasCv,
  cvHref,
}: Pick<
  ArtistTemplateProps,
  'isOwner' | 'profileId' | 'publishedSiteUrl' | 'hasCv' | 'cvHref'
>) {
  if (!isOwner) return null;
  const siteHref = profileId ? `/profile/site?profileId=${profileId}` : '/profile/site';
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" className="bg-wine text-parchment hover:bg-wine/90 font-serif">
        <Link href="/profile">Edit Profile</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="font-serif border-wine/30 hover:bg-wine/10"
      >
        <Link href={siteHref}>
          {publishedSiteUrl ? 'Manage Website' : 'Create Website'}
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="font-serif border-wine/30 hover:bg-wine/10"
      >
        <Link href={cvHref}>
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          {hasCv ? 'View CV' : 'Upload CV'}
        </Link>
      </Button>
    </div>
  );
}

function VisitorBadges({
  publishedSiteUrl,
  hasCv,
  cvHref,
}: Pick<ArtistTemplateProps, 'publishedSiteUrl' | 'hasCv' | 'cvHref'>) {
  if (!publishedSiteUrl && !hasCv) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {publishedSiteUrl && (
        <a
          href={publishedSiteUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-wine/20 bg-wine/5 px-3 py-1.5 text-xs font-serif text-wine hover:bg-wine/10 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Website
        </a>
      )}
      {hasCv && (
        <Link
          href={cvHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-wine/20 bg-wine/5 px-3 py-1.5 text-xs font-serif text-wine hover:bg-wine/10 transition-colors"
        >
          <FileText className="h-3 w-3" />
          CV
        </Link>
      )}
    </div>
  );
}

function ProfileAvatar({
  pictureUrl,
  displayName,
  className = '',
  rounded = 'full',
}: {
  pictureUrl: string | null;
  displayName: string;
  className?: string;
  rounded?: 'full' | 'none' | 'xl';
}) {
  const radius =
    rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-none';
  return (
    <TacoAvatar
      pictureUrl={pictureUrl}
      displayName={displayName}
      priority
      className={`bg-wine/5 border border-wine/20 ${radius} ${className}`}
    />
  );
}

function ArtworkLink({
  artwork,
  className = '',
  imageClassName = '',
  showMeta = true,
}: {
  artwork: ArtistTemplateProps['artworks'][number];
  className?: string;
  imageClassName?: string;
  showMeta?: boolean;
}) {
  return (
    <Link
      href={`/artworks/${artwork.id}/certificate`}
      className={`group block ${className}`}
    >
      <div className={`relative overflow-hidden bg-wine/5 ${imageClassName}`}>
        {artwork.image_url ? (
          <Image
            src={artwork.image_url}
            alt={artwork.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-display text-wine/30">
            No image
          </div>
        )}
      </div>
      {showMeta && (
        <div className="mt-3">
          <p className="font-display font-semibold text-ink group-hover:text-wine transition-colors">
            {artwork.title}
          </p>
          <p className="font-serif text-xs text-ink/45 mt-1">
            {formatYear(artwork.created_at)} · #{artwork.certificate_number}
          </p>
        </div>
      )}
    </Link>
  );
}

function SocialRow({ website, links }: Pick<ArtistTemplateProps, 'website' | 'links'>) {
  if (!website && links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-4">
      {website && <SocialLinkItem url={website} />}
      {links.map((link) => (
        <SocialLinkItem key={link} url={link} />
      ))}
    </div>
  );
}

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

function FadeSection({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, visible } = useFadeIn();
  return (
    <div
      ref={ref}
      className={`transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

// ─── 1. Manifesto ────────────────────────────────────────────────────────────

export function ManifestoTemplate(props: ArtistTemplateProps) {
  const {
    displayName,
    medium,
    location,
    memberSince,
    bio,
    pictureUrl,
    artworks,
    exhibitions,
    press,
    streak,
    ...actions
  } = props;

  const firstArtworks = artworks.slice(0, 2);
  const restArtworks = artworks.slice(2);

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <style>{`
        @keyframes manifestoReveal {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .manifesto-scroll-reveal {
          animation: manifestoReveal linear both;
          animation-timeline: view();
          animation-range: entry 0% cover 35%;
        }
      `}</style>

      <header className="relative min-h-[85vh] border-b border-wine/15 overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-[28vw] min-w-[120px] max-w-[280px] hidden md:block">
          <ProfileAvatar
            pictureUrl={pictureUrl}
            displayName={displayName}
            rounded="none"
            className="h-full w-full border-0 border-l border-wine/20"
          />
        </div>
        <div className="container mx-auto px-4 max-w-[90rem] py-16 md:py-24 pr-0 md:pr-[30vw]">
          <p className="text-[10px] uppercase tracking-[0.4em] text-wine/50 font-serif mb-6">
            {medium || 'Artist'}
          </p>
          <h1 className="font-display font-bold uppercase leading-[0.88] tracking-tight text-[clamp(3rem,12vw,9rem)] break-words max-w-[80vw]">
            {displayName}
          </h1>
          <div className="mt-12 flex flex-col gap-4 font-serif text-sm text-ink/50">
            {location && (
              <span className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-wine/40" />
                {location}
              </span>
            )}
            {memberSince && (
              <span>
                Member since{' '}
                {new Date(memberSince).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                })}
              </span>
            )}
            {streak && (
              <StreakStar tier={streak.starTier} streakDays={streak.currentStreakDays} isFoundingArtist={streak.isFoundingArtist} />
            )}
            <SocialRow website={props.website} links={props.links} />
            <div className="flex flex-wrap gap-3 pt-2">
              <OwnerActions {...actions} />
              {!props.isOwner && (
                <VisitorBadges
                  publishedSiteUrl={props.publishedSiteUrl}
                  hasCv={props.hasCv}
                  cvHref={props.cvHref}
                />
              )}
            </div>
          </div>
        </div>
        <div className="md:hidden relative h-48 mx-4 mb-8 border border-wine/20">
          <ProfileAvatar
            pictureUrl={pictureUrl}
            displayName={displayName}
            rounded="none"
            className="h-full w-full"
          />
        </div>
      </header>

      <div className="max-w-[90rem] mx-auto">
        {firstArtworks.map((artwork, i) => (
          <section
            key={artwork.id}
            className={`manifesto-scroll-reveal grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-wine/10 ${
              i % 2 === 1 ? 'lg:flex-row-reverse' : ''
            }`}
          >
            <div
              className={`lg:col-span-7 relative aspect-[4/3] lg:aspect-auto lg:min-h-[70vh] ${
                i % 2 === 1 ? 'lg:order-2' : ''
              }`}
            >
              <ArtworkLink artwork={artwork} className="h-full" imageClassName="h-full min-h-[50vh]" />
            </div>
            <div
              className={`lg:col-span-5 flex flex-col justify-end p-8 md:p-14 ${
                i % 2 === 1 ? 'lg:order-1' : ''
              }`}
            >
              <p className="text-[10px] uppercase tracking-widest text-wine/40 font-serif mb-2">
                Work {String(i + 1).padStart(2, '0')}
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-bold">{artwork.title}</h2>
              <p className="font-serif text-sm text-ink/50 mt-2">
                #{artwork.certificate_number}
              </p>
            </div>
          </section>
        ))}

        {bio && (
          <blockquote className="manifesto-scroll-reveal px-6 md:px-20 py-24 md:py-32 border-b border-wine/10">
            <p className="font-display text-2xl md:text-4xl leading-relaxed text-ink/90 max-w-4xl italic">
              {bio}
            </p>
          </blockquote>
        )}

        {restArtworks.map((artwork, i) => {
          const idx = i + firstArtworks.length;
          return (
            <section
              key={artwork.id}
              className={`manifesto-scroll-reveal grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-wine/10`}
            >
              <div
                className={`lg:col-span-7 relative aspect-[4/3] lg:aspect-auto lg:min-h-[65vh] ${
                  idx % 2 === 1 ? 'lg:order-2' : ''
                }`}
              >
                <ArtworkLink artwork={artwork} className="h-full" imageClassName="h-full min-h-[50vh]" />
              </div>
              <div
                className={`lg:col-span-5 flex flex-col justify-end p-8 md:p-14 ${
                  idx % 2 === 1 ? 'lg:order-1' : ''
                }`}
              >
                <h2 className="font-display text-2xl md:text-3xl font-bold">{artwork.title}</h2>
              </div>
            </section>
          );
        })}

        {artworks.length === 0 && (
          <p className="py-24 text-center font-serif text-ink/50">No works published yet.</p>
        )}

        {exhibitions.length > 0 && (
          <section className="px-6 md:px-20 py-20 border-b border-wine/10">
            <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-10">
              Exhibitions
            </p>
            <ul className="space-y-4 font-serif text-sm md:text-base">
              {exhibitions.map((ex) => (
                <li key={ex.id} className="grid grid-cols-[4rem_1fr] md:grid-cols-[5rem_1fr] gap-4">
                  <span className="text-wine/60 tabular-nums">
                    {exhibitionYear(ex.start_date, ex.end_date)}
                  </span>
                  <span>
                    <Link href={`/exhibitions/${ex.id}`} className="hover:text-wine transition-colors">
                      {ex.title}
                    </Link>
                    {ex.location && (
                      <span className="text-ink/45"> — {ex.location}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {press.length > 0 && (
          <section className="py-8 overflow-hidden border-b border-wine/10">
            <div className="flex gap-12 animate-[marquee_40s_linear_infinite] whitespace-nowrap font-serif text-sm">
              {[...press, ...press].map((pub, i) => (
                <a
                  key={`${pub.url}-${i}`}
                  href={pub.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-wine/80 hover:text-wine shrink-0"
                >
                  {pub.title}
                  {pub.publication_name ? ` · ${pub.publication_name}` : ''}
                </a>
              ))}
            </div>
            <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── 2. Darkroom ─────────────────────────────────────────────────────────────

export function DarkroomTemplate(props: ArtistTemplateProps) {
  const { displayName, medium, location, bio, pictureUrl, artworks, exhibitions, press, streak, ...actions } =
    props;

  return (
    <div className="min-h-screen bg-[#0F0F12] text-[#F0EBE0]">
      <header className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {pictureUrl && (
          <div className="absolute inset-0 opacity-30">
            <Image src={pictureUrl} alt="" fill className="object-cover grayscale" unoptimized />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F0F12]/40 via-transparent to-[#0F0F12]" />
        <div className="relative z-10 text-center px-6 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#F0EBE0]/40 font-serif mb-4">
            {medium || 'Artist'}
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">{displayName}</h1>
          {location && (
            <p className="mt-4 font-serif text-sm text-[#F0EBE0]/35">{location}</p>
          )}
          {streak && (
            <div className="mt-6 flex justify-center">
              <StreakStar tier={streak.starTier} streakDays={streak.currentStreakDays} isFoundingArtist={streak.isFoundingArtist} />
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <OwnerActions {...actions} />
            {!props.isOwner && (
              <VisitorBadges
                publishedSiteUrl={props.publishedSiteUrl}
                hasCv={props.hasCv}
                cvHref={props.cvHref}
              />
            )}
          </div>
          <div className="mt-6 flex justify-center">
            <SocialRow website={props.website} links={props.links} />
          </div>
        </div>
      </header>

      {artworks.length > 0 ? (
        <section className="px-4 md:px-8 py-16 max-w-7xl mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-[#8B1A1A] font-serif mb-8">Works</p>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {artworks.map((artwork, i) => (
              <div
                key={artwork.id}
                className="break-inside-avoid group"
                style={{ marginBottom: i % 3 === 0 ? '2rem' : i % 3 === 1 ? '4rem' : '1rem' }}
              >
                <Link
                  href={`/artworks/${artwork.id}/certificate`}
                  className="block relative overflow-hidden rounded-sm border border-[#8B1A1A]/20 hover:shadow-[0_0_40px_rgba(139,26,26,0.25)] transition-shadow duration-500"
                  style={{
                    aspectRatio: i % 3 === 0 ? '3/4' : i % 3 === 1 ? '1/1' : '4/5',
                  }}
                >
                  {artwork.image_url ? (
                    <Image
                      src={artwork.image_url}
                      alt={artwork.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#1a1a22] flex items-center justify-center text-[#F0EBE0]/30 font-display">
                      {artwork.title}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="font-display text-sm">{artwork.title}</p>
                    <p className="font-serif text-xs text-[#F0EBE0]/60">
                      #{artwork.certificate_number}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="py-20 text-center font-serif text-[#F0EBE0]/40">No works in the darkroom yet.</p>
      )}

      {exhibitions.length > 0 && (
        <section className="py-12 border-t border-[#8B1A1A]/20">
          <p className="px-6 text-[10px] uppercase tracking-widest text-[#8B1A1A] font-serif mb-6">
            Exhibitions
          </p>
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-6 pb-4 scrollbar-thin">
            {exhibitions.map((ex) => (
              <Link
                key={ex.id}
                href={`/exhibitions/${ex.id}`}
                className="snap-center shrink-0 w-[280px] p-6 border border-[#8B1A1A]/30 rounded-lg bg-[#141418] hover:border-[#8B1A1A]/60 transition-colors"
              >
                <h3 className="font-display font-semibold text-lg mb-2">{ex.title}</h3>
                <p className="font-serif text-xs text-[#F0EBE0]/50 flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {formatDate(ex.start_date)}
                </p>
                {ex.location && (
                  <p className="font-serif text-xs text-[#F0EBE0]/40 mt-2">{ex.location}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {bio && (
        <section className="max-w-2xl mx-auto px-6 py-32 border-t border-[#8B1A1A]/15">
          <p className="text-[10px] uppercase tracking-widest text-[#F0EBE0]/30 font-serif mb-6">
            Liner notes
          </p>
          <p className="font-serif text-base leading-[1.9] text-[#F0EBE0]/75 whitespace-pre-wrap">
            {bio}
          </p>
        </section>
      )}

      {press.length > 0 && (
        <section className="px-6 py-16 border-t border-[#8B1A1A]/15 max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-[#8B1A1A] font-serif mb-6">Press</p>
          <ul className="space-y-4">
            {press.map((pub, i) => (
              <li key={i}>
                <a
                  href={pub.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-serif text-[#8B1A1A] hover:underline"
                >
                  {pub.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─── 3. Archive ──────────────────────────────────────────────────────────────

export function ArchiveTemplate(props: ArtistTemplateProps) {
  const {
    displayName,
    medium,
    location,
    bio,
    pictureUrl,
    artworks,
    exhibitions,
    press,
    memberSince,
    streak,
    ...actions
  } = props;

  const indexNum = String(artworks.length).padStart(3, '0');

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <header className="border-b border-ink/20 px-4 md:px-8 py-8 max-w-[90rem] mx-auto">
        <div className="grid grid-cols-12 gap-4 items-start">
          <div className="col-span-10 md:col-span-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight uppercase">
              {displayName}
            </h1>
            <p className="font-serif text-xs text-ink/50 mt-2">
              {[medium, location, memberSince && `Est. ${formatYear(memberSince)}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="col-span-2 md:col-span-1 md:col-start-12 text-right font-mono text-xs text-ink/40">
            {indexNum}
          </div>
          <div className="col-span-12 md:col-span-2 md:col-start-11 flex justify-end">
            <ProfileAvatar
              pictureUrl={pictureUrl}
              displayName={displayName}
              className="w-16 h-16 md:w-20 md:h-20"
            />
          </div>
        </div>
        <hr className="mt-6 border-ink/20" />
        <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
          <SocialRow website={props.website} links={props.links} />
          <OwnerActions {...actions} />
          {!props.isOwner && (
            <VisitorBadges
              publishedSiteUrl={props.publishedSiteUrl}
              hasCv={props.hasCv}
              cvHref={props.cvHref}
            />
          )}
          {streak && <StreakStar tier={streak.starTier} streakDays={streak.currentStreakDays} isFoundingArtist={streak.isFoundingArtist} />}
        </div>
      </header>

      <div className="max-w-[90rem] mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-12 gap-x-4 gap-y-12">
          {bio && (
            <div className="col-span-12 md:col-span-3 font-serif text-sm leading-relaxed text-ink/80 whitespace-pre-wrap">
              <p className="text-[10px] uppercase tracking-widest text-ink/35 mb-4">Statement</p>
              {bio}
            </div>
          )}

          {artworks.length > 0 ? (
            artworks.map((artwork) => (
              <div key={artwork.id} className="col-span-12 sm:col-span-6 md:col-span-4">
                <ArtworkLink
                  artwork={artwork}
                  imageClassName="aspect-[4/5] w-full"
                  showMeta
                />
                <p className="font-mono text-[10px] text-ink/40 mt-2 uppercase tracking-wider">
                  {artwork.title} / {formatYear(artwork.created_at)} / #{artwork.certificate_number}
                </p>
              </div>
            ))
          ) : (
            <p className="col-span-12 font-serif text-ink/50 text-center py-16">
              Catalog empty.
            </p>
          )}
        </div>

        {exhibitions.length > 0 && (
          <section className="mt-20 border-t border-ink/15 pt-12">
            <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-8">
              Exhibition record
            </p>
            <div className="grid grid-cols-12 gap-y-3 font-serif text-sm">
              {exhibitions.map((ex) => (
                <div key={ex.id} className="col-span-12 grid grid-cols-12 gap-4 py-2 border-b border-ink/8">
                  <span className="col-span-2 md:col-span-1 text-ink/45 tabular-nums">
                    {exhibitionYear(ex.start_date, ex.end_date)}
                  </span>
                  <div className="col-span-10 md:col-span-11">
                    <Link href={`/exhibitions/${ex.id}`} className="font-medium hover:text-wine">
                      {ex.title}
                    </Link>
                    {ex.location && (
                      <span className="text-ink/45"> — {ex.location}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {press.length > 0 && (
          <section className="mt-16 border-t border-ink/15 pt-12">
            <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-6">Press</p>
            <div
              className="font-serif text-sm leading-relaxed gap-8"
              style={{ columnCount: 3, columnGap: '2rem' }}
            >
              {press.map((pub, i) => (
                <p key={i} className="mb-4 break-inside-avoid">
                  <a href={pub.url} target="_blank" rel="noreferrer" className="text-wine hover:underline">
                    {pub.title}
                  </a>
                  {pub.publication_name && (
                    <span className="text-ink/45"> — {pub.publication_name}</span>
                  )}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── 4. Kinetic ──────────────────────────────────────────────────────────────

export function KineticTemplate(props: ArtistTemplateProps) {
  const { displayName, medium, location, bio, pictureUrl, artworks, exhibitions, press, streak, ...actions } =
    props;

  const bioWords = bio ? bio.split(/\s+/) : [];

  return (
    <div className="min-h-screen bg-parchment text-ink relative">
      <style>{`
        @keyframes kineticTitle {
          from { transform: scale(4); opacity: 0.15; }
          to { transform: scale(1); opacity: 1; }
        }
        .kinetic-title {
          animation: kineticTitle linear both;
          animation-timeline: view();
          animation-range: entry 0% cover 40%;
        }
        @keyframes kineticSlideL {
          from { opacity: 0; transform: translateX(-80px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes kineticSlideR {
          from { opacity: 0; transform: translateX(80px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .kinetic-from-left {
          animation: kineticSlideL linear both;
          animation-timeline: view();
          animation-range: entry 5% cover 40%;
        }
        .kinetic-from-right {
          animation: kineticSlideR linear both;
          animation-timeline: view();
          animation-range: entry 5% cover 40%;
        }
        .kinetic-word {
          opacity: 0.2;
          animation: kineticWord linear forwards;
          animation-timeline: view();
          animation-range: entry 10% cover 50%;
        }
        @keyframes kineticWord {
          to { opacity: 1; }
        }
      `}</style>

      <div className="fixed top-4 left-4 z-50 w-12 h-12 rounded-full border-2 border-wine/30 overflow-hidden shadow-lg bg-parchment">
        <ProfileAvatar pictureUrl={pictureUrl} displayName={displayName} className="w-full h-full" />
      </div>

      <header className="min-h-[100vh] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="kinetic-title font-display font-bold text-4xl md:text-6xl tracking-tight origin-center">
          {displayName}
        </h1>
        <p className="mt-4 font-serif text-sm text-ink/50">{medium}</p>
        {location && (
          <p className="mt-2 font-serif text-xs text-ink/40 flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3" /> {location}
          </p>
        )}
        {streak && (
          <div className="mt-6">
            <StreakStar tier={streak.starTier} streakDays={streak.currentStreakDays} isFoundingArtist={streak.isFoundingArtist} />
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <OwnerActions {...actions} />
          {!props.isOwner && (
            <VisitorBadges
              publishedSiteUrl={props.publishedSiteUrl}
              hasCv={props.hasCv}
              cvHref={props.cvHref}
            />
          )}
        </div>
      </header>

      {artworks.map((artwork, i) => (
        <section
          key={artwork.id}
          className={`min-h-[70vh] flex items-center px-6 md:px-16 py-20 ${
            i % 2 === 0 ? 'kinetic-from-left' : 'kinetic-from-right'
          }`}
        >
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full">
            <ArtworkLink
              artwork={artwork}
              imageClassName="aspect-square w-full max-h-[70vh]"
            />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-wine/40 font-serif">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h2 className="font-display text-3xl font-bold mt-2">{artwork.title}</h2>
            </div>
          </div>
        </section>
      ))}

      {bioWords.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-32 font-serif text-xl leading-relaxed">
          {bioWords.map((word, i) => (
            <span
              key={i}
              className="kinetic-word inline-block mr-[0.25em]"
              style={{ animationDelay: `${i * 20}ms` }}
            >
              {word}
            </span>
          ))}
        </section>
      )}

      {exhibitions.length > 0 && (
        <section className="max-w-xl mx-auto px-6 py-24">
          <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-12">
            Timeline
          </p>
          <div className="relative pl-8 border-l-2 border-wine/20 space-y-10">
            {exhibitions.map((ex) => (
              <div key={ex.id} className="relative">
                <span className="absolute -left-[calc(0.5rem+5px)] top-1.5 w-3 h-3 rounded-full bg-wine border-2 border-parchment" />
                <p className="font-mono text-xs text-wine/60">
                  {exhibitionYear(ex.start_date, ex.end_date)}
                </p>
                <Link
                  href={`/exhibitions/${ex.id}`}
                  className="font-display font-semibold text-lg hover:text-wine block mt-1"
                >
                  {ex.title}
                </Link>
                {ex.location && (
                  <p className="font-serif text-sm text-ink/50 mt-1">{ex.location}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {press.length > 0 && (
        <section className="px-6 py-16 max-w-2xl mx-auto border-t border-wine/10">
          <ul className="space-y-3 font-serif text-sm">
            {press.map((pub, i) => (
              <li key={i}>
                <a href={pub.url} target="_blank" rel="noreferrer" className="text-wine hover:underline">
                  {pub.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="h-32" />
    </div>
  );
}

// ─── 5. Broadsheet ───────────────────────────────────────────────────────────

export function BroadsheetTemplate(props: ArtistTemplateProps) {
  const {
    displayName,
    medium,
    location,
    bio,
    artworks,
    exhibitions,
    press,
    memberSince,
    streak,
    ...actions
  } = props;

  const [lead, ...secondary] = artworks;
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-ink">
      <header className="border-b-2 border-ink px-4 md:px-8 py-4 max-w-6xl mx-auto">
        <div className="flex justify-between items-baseline text-[10px] font-serif uppercase tracking-widest text-ink/50">
          <span>Provenance</span>
          <span>Artist Profile</span>
          <span className="hidden sm:inline">{today}</span>
        </div>
        <hr className="my-3 border-ink" />
        <h1 className="font-display text-5xl md:text-7xl font-bold leading-[0.95] tracking-tight break-words">
          {displayName}
        </h1>
        <p className="font-serif text-sm mt-2 text-ink/60">
          {[medium, location].filter(Boolean).join(' · ')}
          {memberSince && ` · Member since ${formatYear(memberSince)}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <OwnerActions {...actions} />
          {!props.isOwner && (
            <VisitorBadges
              publishedSiteUrl={props.publishedSiteUrl}
              hasCv={props.hasCv}
              cvHref={props.cvHref}
            />
          )}
          {streak && <StreakStar tier={streak.starTier} streakDays={streak.currentStreakDays} isFoundingArtist={streak.isFoundingArtist} />}
        </div>
      </header>

      <article className="max-w-6xl mx-auto px-4 md:px-8 py-10 columns-1 md:columns-2 lg:columns-4 gap-8 font-serif text-sm leading-relaxed">
        {props.pictureUrl && (
          <div className="float-right ml-4 mb-4 w-28 h-36 relative border-2 border-ink overflow-hidden break-inside-avoid">
            <Image
              src={props.pictureUrl}
              alt={displayName}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {bio && (
          <p className="mb-4 text-justify whitespace-pre-wrap">{bio}</p>
        )}

        {lead && (
          <figure className="float-right ml-4 mb-4 w-full max-w-[200px] break-inside-avoid">
            <Link href={`/artworks/${lead.id}/certificate`} className="block relative aspect-[3/4] border border-ink/20">
              {lead.image_url && (
                <Image src={lead.image_url} alt={lead.title} fill className="object-cover" unoptimized />
              )}
            </Link>
            <figcaption className="text-[10px] mt-1 text-ink/50">
              {lead.title} · #{lead.certificate_number}
            </figcaption>
          </figure>
        )}

        {exhibitions.length > 0 && (
          <div className="mb-4 break-inside-avoid">
            <p className="font-display font-bold text-xs uppercase tracking-wider mb-2">Exhibitions</p>
            {exhibitions.map((ex) => (
              <p key={ex.id} className="mb-2">
                <Link href={`/exhibitions/${ex.id}`} className="font-semibold hover:text-wine">
                  {ex.title}
                </Link>
                {' '}
                ({formatDate(ex.start_date)}
                {ex.location ? `, ${ex.location}` : ''})
              </p>
            ))}
          </div>
        )}

        {secondary.map((artwork) => (
          <figure key={artwork.id} className="mb-6 break-inside-avoid">
            <Link
              href={`/artworks/${artwork.id}/certificate`}
              className="block relative aspect-video border border-ink/15 mb-2"
            >
              {artwork.image_url && (
                <Image src={artwork.image_url} alt={artwork.title} fill className="object-cover" unoptimized />
              )}
            </Link>
            <figcaption className="text-[10px] text-ink/50">
              {artwork.title}
            </figcaption>
          </figure>
        ))}

        {press.length > 0 && (
          <div className="break-inside-avoid">
            <p className="font-display font-bold text-xs uppercase tracking-wider mb-2">Press</p>
            {press.map((pub, i) => (
              <p key={i} className="mb-2">
                <a href={pub.url} target="_blank" rel="noreferrer" className="underline hover:text-wine">
                  {pub.title}
                </a>
                {pub.publication_name && ` — ${pub.publication_name}`}
              </p>
            ))}
          </div>
        )}

        <div className="break-inside-avoid clear-both">
          <SocialRow website={props.website} links={props.links} />
        </div>
      </article>

      {artworks.length === 0 && (
        <p className="text-center py-20 font-serif text-ink/50">No works filed.</p>
      )}
    </div>
  );
}

// ─── 6. Void ─────────────────────────────────────────────────────────────────

export function VoidTemplate(props: ArtistTemplateProps) {
  const { displayName, medium, bio, pictureUrl, artworks, exhibitions, press, streak, ...actions } =
    props;

  const [showExhibitions, setShowExhibitions] = useState(false);
  const [showPress, setShowPress] = useState(false);

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <div className="max-w-[600px] mx-auto px-6 py-32 md:py-40">
        <FadeSection>
          <p
            className="font-display font-black text-sm uppercase text-center"
            style={{ letterSpacing: '0.5em' }}
          >
            {displayName}
          </p>
          {medium && (
            <p className="text-center font-serif text-xs text-ink/35 mt-6 tracking-widest uppercase">
              {medium}
            </p>
          )}
          {streak && (
            <div className="flex justify-center mt-8">
              <span
                className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.8)]"
                title={`${streak.starTier} · ${streak.currentStreakDays} day streak`}
              />
            </div>
          )}
          <div className="mt-12 flex justify-center opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
            <OwnerActions {...actions} />
            {!props.isOwner && (
              <VisitorBadges
                publishedSiteUrl={props.publishedSiteUrl}
                hasCv={props.hasCv}
                cvHref={props.cvHref}
              />
            )}
          </div>
        </FadeSection>

        {pictureUrl && (
          <FadeSection className="my-24">
            <div className="relative aspect-square w-48 mx-auto opacity-90 hover:opacity-100 transition-opacity">
              <ProfileAvatar pictureUrl={pictureUrl} displayName={displayName} className="w-full h-full" />
            </div>
          </FadeSection>
        )}

        {bio && (
          <FadeSection className="my-32">
            <p className="font-serif text-lg md:text-xl leading-[2] text-ink/85 text-center whitespace-pre-wrap">
              {bio}
            </p>
          </FadeSection>
        )}

        {artworks.map((artwork) => (
          <FadeSection key={artwork.id} className="my-40 md:my-56">
            <ArtworkLink
              artwork={artwork}
              imageClassName="aspect-[4/5] w-full"
              showMeta={false}
            />
            <p className="text-center font-serif text-xs text-ink/30 mt-8 opacity-0 hover:opacity-100 transition-opacity">
              {artwork.title}
            </p>
          </FadeSection>
        ))}

        {artworks.length === 0 && (
          <p className="text-center font-serif text-ink/30 py-40">—</p>
        )}

        {exhibitions.length > 0 && (
          <FadeSection className="my-24">
            <button
              type="button"
              onClick={() => setShowExhibitions((v) => !v)}
              className="w-full text-center font-serif text-xs text-ink/40 hover:text-ink/70 transition-colors flex items-center justify-center gap-2 group"
            >
              → {exhibitions.length} exhibition{exhibitions.length !== 1 ? 's' : ''}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showExhibitions ? 'rotate-180' : ''}`}
              />
            </button>
            {showExhibitions && (
              <ul className="mt-8 space-y-6 text-center font-serif text-sm text-ink/60">
                {exhibitions.map((ex) => (
                  <li key={ex.id}>
                    <Link href={`/exhibitions/${ex.id}`} className="hover:text-wine">
                      {ex.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </FadeSection>
        )}

        {press.length > 0 && (
          <FadeSection className="my-24 pb-40">
            <button
              type="button"
              onClick={() => setShowPress((v) => !v)}
              className="w-full text-center font-serif text-xs text-ink/40 hover:text-ink/70 transition-colors flex items-center justify-center gap-2"
            >
              → {press.length} press mention{press.length !== 1 ? 's' : ''}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showPress ? 'rotate-180' : ''}`}
              />
            </button>
            {showPress && (
              <ul className="mt-8 space-y-4 text-center font-serif text-sm">
                {press.map((pub, i) => (
                  <li key={i}>
                    <a href={pub.url} target="_blank" rel="noreferrer" className="text-wine/70 hover:text-wine hover:underline">
                      {pub.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </FadeSection>
        )}

        <div className="opacity-0 hover:opacity-100 transition-opacity pt-8">
          <SocialRow website={props.website} links={props.links} />
        </div>
      </div>
    </div>
  );
}

