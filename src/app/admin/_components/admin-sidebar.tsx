'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@kit/ui/utils';
import { adminSidebarClass } from './admin-dash-tokens';

const NAV: { href: string; label: string }[] = [
  { href: '/admin', label: 'overview' },
  { href: '/admin/feedback', label: 'feedback' },
  { href: '/admin/about', label: 'about' },
  { href: '/admin/pitch', label: 'pitch' },
  { href: '/admin/blog', label: 'blog' },
  { href: '/admin/emails', label: 'emails' },
  { href: '/admin/users', label: 'users' },
  { href: '/admin/api-keys', label: 'api-keys' },
  { href: '/admin/queued-artworks', label: 'queued' },
];

function navActive(pathname: string, href: string): boolean {
  if (href === '/admin') {
    return pathname === '/admin';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname() || '';

  return (
    <aside className={adminSidebarClass}>
      <div className="px-2 font-mono text-[11px] text-[#1793d1]/80">[prov@enance]</div>
      <div className="mb-6 px-2 font-mono text-base font-semibold tracking-tight text-slate-100">
        ~/admin
      </div>
      <nav className="space-y-0.5" aria-label="Admin sections">
        {NAV.map(({ href, label }) => {
          const active = navActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'block rounded-sm px-2 py-1.5 font-mono text-[13px] leading-tight',
                active
                  ? 'bg-[#1793d1]/15 text-[#67d4ff]'
                  : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300',
              )}
            >
              <span className="mr-1.5 text-[#1793d1]/50">$</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-8 px-2 font-mono text-[10px] leading-relaxed text-slate-600">
        Simplicity · modern · pragmatic
      </p>
      <Link
        href="/"
        className="mt-4 block px-2 font-mono text-[11px] text-[#1793d1]/70 underline-offset-2 hover:text-[#67d4ff] hover:underline"
      >
        ← Back to Provenance
      </Link>
    </aside>
  );
}
