'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@kit/ui/utils';
import {
  DOC_SECTIONS,
  docHref,
  getDocsByGroup,
  type DocEntry,
} from '../_lib/docs-manifest';
import { docsSidebarClass } from './docs-tokens';

function navActive(pathname: string, href: string): boolean {
  if (href === '/docs') {
    return pathname === '/docs';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function filterEntries(entries: DocEntry[], query: string): DocEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.slug.toLowerCase().includes(q),
  );
}

export function DocsSidebar() {
  const pathname = usePathname() || '';
  const [query, setQuery] = useState('');

  const filteredSections = useMemo(
    () =>
      DOC_SECTIONS.map((section) => ({
        ...section,
        entries: filterEntries(getDocsByGroup(section.id), query),
      })).filter((s) => s.entries.length > 0),
    [query],
  );

  return (
    <aside className={docsSidebarClass}>
      <div className="px-2 font-mono text-[11px] text-[#1793d1]/80">[prov@enance]</div>
      <div className="mb-4 px-2 font-mono text-base font-semibold tracking-tight text-slate-100">
        ~/docs
      </div>

      <div className="mb-4 px-1">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter docs…"
          aria-label="Filter documentation"
          className="w-full rounded-sm border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#1793d1]/50"
        />
      </div>

      <nav className="space-y-5" aria-label="Documentation sections">
        <div>
          <Link
            href="/docs"
            className={cn(
              'block rounded-sm px-2 py-1.5 font-mono text-[13px] leading-tight',
              navActive(pathname, '/docs') && pathname === '/docs'
                ? 'bg-[#1793d1]/15 text-[#67d4ff]'
                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300',
            )}
          >
            <span className="mr-1.5 text-[#1793d1]/50">$</span>
            home
          </Link>
        </div>

        {filteredSections.map((section) => (
          <div key={section.id}>
            <p className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#1793d1]/60">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.entries.map((entry) => {
                const href = docHref(entry.slug);
                const active = navActive(pathname, href);
                return (
                  <Link
                    key={entry.slug}
                    href={href}
                    className={cn(
                      'block rounded-sm px-2 py-1.5 font-mono text-[13px] leading-tight',
                      active
                        ? 'bg-[#1793d1]/15 text-[#67d4ff]'
                        : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300',
                    )}
                  >
                    <span className="mr-1.5 text-[#1793d1]/50">$</span>
                    {entry.title.toLowerCase()}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <p className="mt-8 px-2 font-mono text-[10px] leading-relaxed text-slate-600">
        Preserving cultural heritage
      </p>
    </aside>
  );
}
