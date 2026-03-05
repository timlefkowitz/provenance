'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/investors', label: 'Investor materials' },
  { href: '/investors/one-pager', label: 'One-pager' },
  { href: '/investors/confidential-memo', label: 'Confidential memo' },
  { href: '/investors/monthly-expenses', label: 'Monthly expenses' },
] as const;

export function InvestorsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-b border-wine/30 bg-parchment/95 sticky top-0 z-10"
      aria-label="Investor materials"
    >
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-4">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 font-body text-sm">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive =
              href === '/investors'
                ? pathname === '/investors'
                : pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={
                    isActive
                      ? 'text-wine font-semibold underline underline-offset-4'
                      : 'text-ink/80 hover:text-wine hover:underline underline-offset-4'
                  }
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
