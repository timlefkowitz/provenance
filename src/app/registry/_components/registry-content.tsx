'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@kit/ui/utils';
import { resolveRegistryDirectoryRole } from '~/config/registry-directory-role-overrides';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { registryRowKey } from '../_lib/registry-row-key';

export type RegistryAccount = {
  id: string;
  name: string;
  picture_url: string | null;
  public_data: unknown;
  created_at: string | null;
  role?: string;
  profileId?: string;
  profileSlug?: string | null;
  listPreviewUrl: string | null;
  listPreviewUsesArtwork: boolean;
};

type RegistryContentProps = {
  accounts: RegistryAccount[];
  artworkCounts: Record<string, number>;
};

function resolveRole(account: RegistryAccount) {
  const base =
    account.role || getUserRole(account.public_data as Record<string, unknown> | null);
  return resolveRegistryDirectoryRole(account.name, base);
}

function buildLinkUrl(account: RegistryAccount, role: string | null) {
  if (role === USER_ROLES.GALLERY && account.profileSlug) {
    return `/g/${encodeURIComponent(account.profileSlug)}`;
  }
  if (account.profileId && role === USER_ROLES.GALLERY) {
    return `/artists/${account.id}?role=gallery&profileId=${account.profileId}`;
  }
  return `/artists/${account.id}${role ? `?role=${role}` : ''}`;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mt-14 first:mt-0 mb-6">
      <span className="shrink-0 text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase whitespace-nowrap">
        {label}
      </span>
      <span className="h-px flex-1 bg-wine/15 min-w-[2rem]" aria-hidden />
    </div>
  );
}

export function RegistryContent({ accounts, artworkCounts }: RegistryContentProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [profilePreviewHover, setProfilePreviewHover] = useState(false);

  const { galleries, artists } = useMemo(() => {
    const g: RegistryAccount[] = [];
    const a: RegistryAccount[] = [];
    for (const account of accounts) {
      const role = resolveRole(account);
      if (role === USER_ROLES.GALLERY) {
        g.push(account);
      } else {
        a.push(account);
      }
    }
    return { galleries: g, artists: a };
  }, [accounts]);

  const defaultAccount = galleries[0] ?? artists[0] ?? null;

  const activeAccount = useMemo(() => {
    if (!hoveredKey) {
      return defaultAccount;
    }
    const found = accounts.find((acc) => registryRowKey(acc) === hoveredKey);
    return found ?? defaultAccount;
  }, [hoveredKey, accounts, defaultAccount]);

  const activeKey = activeAccount ? registryRowKey(activeAccount) : null;

  useEffect(() => {
    setProfilePreviewHover(false);
  }, [activeKey]);

  const setHoverFor = useCallback((account: RegistryAccount) => {
    setHoveredKey(registryRowKey(account));
  }, []);

  const clearHover = useCallback(() => {
    setHoveredKey(null);
  }, []);

  const previewUrl = activeAccount?.listPreviewUrl;
  const previewAlt = activeAccount?.name ?? 'Directory preview';
  const previewIsArtwork = activeAccount?.listPreviewUsesArtwork ?? false;

  const renderRow = (account: RegistryAccount) => {
    const role = resolveRole(account);
    const key = registryRowKey(account);
    const artworkCountKey =
      account.profileId && role === USER_ROLES.GALLERY
        ? `${account.id}-${account.profileId}`
        : account.id;
    const artworkCount = artworkCounts[artworkCountKey] || 0;
    const href = buildLinkUrl(account, role);
    const isActive = activeAccount && registryRowKey(activeAccount) === key;

    return (
      <li key={key} className="leading-none">
        <Link
          href={href}
          className={`group block py-3 md:py-4 outline-none transition-colors font-landing text-sm md:text-base tracking-[0.18em] uppercase ${
            isActive ? 'text-wine' : 'text-ink/55 hover:text-wine'
          }`}
          onMouseEnter={() => setHoverFor(account)}
          onFocus={() => setHoverFor(account)}
        >
          <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-normal">{account.name}</span>
            {artworkCount > 0 && (
              <span className="text-[10px] md:text-[11px] tracking-[0.2em] text-ink/35 font-light normal-case">
                {artworkCount} {artworkCount === 1 ? 'work' : 'works'}
              </span>
            )}
          </span>
        </Link>
      </li>
    );
  };

  const empty = galleries.length === 0 && artists.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 md:py-16 font-landing">
      <header className="mb-10 md:mb-14">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.08em] sm:tracking-[0.12em] text-wine">
          ARTISTS
        </h1>
        <p className="mt-4 text-xs sm:text-sm font-light tracking-[0.22em] text-ink/50 uppercase max-w-md">
          Galleries and artists on Provenance
        </p>
      </header>

      {empty ? (
        <p className="text-ink/60 font-serif text-lg py-16">No artists or galleries registered yet</p>
      ) : (
        <div
          className="flex flex-col lg:flex-row lg:gap-16 xl:gap-24"
          onMouseLeave={clearHover}
        >
          <div className="lg:w-[min(52%,28rem)] shrink-0 order-1">
            {galleries.length > 0 && (
              <>
                <SectionHeader label="Galleries" />
                <ul className="divide-y divide-wine/[0.06]">{galleries.map(renderRow)}</ul>
              </>
            )}

            {artists.length > 0 && (
              <>
                <SectionHeader label="Artists" />
                <ul className="divide-y divide-wine/[0.06]">{artists.map(renderRow)}</ul>
              </>
            )}
          </div>

          <aside className="order-2 lg:flex-1 mb-10 lg:mb-0 lg:max-w-md xl:max-w-lg lg:sticky lg:top-24 self-start w-full mx-auto lg:mx-0">
            <div
              className="relative aspect-[4/5] w-full max-w-md mx-auto lg:max-w-none bg-wine/[0.04] overflow-hidden"
              onMouseEnter={() => {
                if (activeAccount && !activeAccount.listPreviewUsesArtwork && activeAccount.listPreviewUrl) {
                  setProfilePreviewHover(true);
                }
              }}
              onMouseLeave={() => setProfilePreviewHover(false)}
            >
              {previewUrl ? (
                previewIsArtwork || !profilePreviewHover ? (
                  <Image
                    src={previewUrl}
                    alt={previewAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 420px"
                    unoptimized
                    priority={!hoveredKey}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-wine/[0.04] p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element -- capped intrinsic display; Next/Image fill would rescale the whole pane */}
                    <img
                      src={previewUrl}
                      alt={previewAlt}
                      className="max-h-48 max-w-48 w-auto h-auto object-contain shadow-sm"
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-wine/[0.06]">
                  <span className="text-ink/30 text-6xl font-bold tracking-widest uppercase">
                    {(previewAlt || '?').charAt(0)}
                  </span>
                </div>
              )}
            </div>
            {activeAccount && (
              <p className="mt-5 text-center lg:text-left text-[11px] tracking-[0.25em] text-ink/45 uppercase truncate">
                {activeAccount.name}
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
