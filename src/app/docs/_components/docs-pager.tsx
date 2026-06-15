import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DocEntry } from '../_lib/docs-manifest';
import { docHref } from '../_lib/docs-manifest';
import { docsButtonPrimary } from './docs-tokens';

type DocsPagerProps = {
  prev: DocEntry | null;
  next: DocEntry | null;
};

export function DocsPager({ prev, next }: DocsPagerProps) {
  if (!prev && !next) return null;

  return (
    <nav
      className="mt-12 flex flex-col gap-3 border-t border-[#1793d1]/15 pt-8 sm:flex-row sm:justify-between"
      aria-label="Documentation pagination"
    >
      {prev ? (
        <Link
          href={docHref(prev.slug)}
          className="group flex items-center gap-2 rounded-sm border border-[#1793d1]/20 bg-[#12151c] px-4 py-3 transition-colors hover:border-[#1793d1]/40 hover:bg-[#161c26]"
        >
          <ChevronLeft className="h-4 w-4 shrink-0 text-[#1793d1]/60 group-hover:text-[#67d4ff]" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-600">
              previous
            </p>
            <p className="font-mono text-sm text-[#67d4ff]">{prev.title}</p>
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={docHref(next.slug)}
          className="group flex items-center justify-end gap-2 rounded-sm border border-[#1793d1]/20 bg-[#12151c] px-4 py-3 text-right transition-colors hover:border-[#1793d1]/40 hover:bg-[#161c26] sm:ml-auto"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-600">next</p>
            <p className="font-mono text-sm text-[#67d4ff]">{next.title}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#1793d1]/60 group-hover:text-[#67d4ff]" />
        </Link>
      ) : null}
    </nav>
  );
}

type DocsBreadcrumbProps = {
  items: { label: string; href?: string }[];
};

export function DocsBreadcrumb({ items }: DocsBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 font-mono text-[11px] text-slate-600">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && <span className="mx-1.5 text-[#1793d1]/40">/</span>}
          {item.href ? (
            <Link href={item.href} className="text-[#1793d1]/70 hover:text-[#67d4ff]">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-500">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function DocsBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={docsButtonPrimary + ' inline-flex items-center gap-1 px-3 py-1.5'}>
      <ChevronLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
