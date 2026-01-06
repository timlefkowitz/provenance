'use client';

import Link from 'next/link';

import appConfig from '~/config/app.config';

export function AppLogo({ href, className }: { href?: string; className?: string }) {
  return (
    <Link href={href ?? '/'} className={className}>
      <span className="text-xl font-serif font-bold tracking-widest uppercase">
        {appConfig.name}
      </span>
    </Link>
  );
}

