'use client';

import Link from 'next/link';

import appConfig from '~/config/app.config';

export function AppLogo({ href, className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href ?? '/'}
      className={className}
      aria-label={appConfig.name}
    >
      <span
        className="text-base font-semibold tracking-[0.3em] uppercase select-none"
        style={{ color: '#4A2F25' }}
      >
        {appConfig.name}
      </span>
    </Link>
  );
}

