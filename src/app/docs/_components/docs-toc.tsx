import Link from 'next/link';
import { cn } from '@kit/ui/utils';
import type { DocHeading } from '../_lib/load-doc';
import { docsMonoLabel, docsTocClass } from './docs-tokens';

type DocsTocProps = {
  headings: DocHeading[];
};

export function DocsToc({ headings }: DocsTocProps) {
  const tocHeadings = headings.filter((h) => h.level >= 2 && h.level <= 3);
  if (tocHeadings.length === 0) return null;

  return (
    <aside className={docsTocClass} aria-label="On this page">
      <p className={docsMonoLabel + ' mb-3 sticky top-6'}>on this page</p>
      <nav className="sticky top-10 space-y-1">
        {tocHeadings.map((h) => (
          <Link
            key={h.id}
            href={`#${h.id}`}
            className={cn(
              'block font-mono text-[12px] leading-snug text-slate-500 transition-colors hover:text-[#67d4ff]',
              h.level === 3 && 'pl-3',
            )}
          >
            {h.text}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
