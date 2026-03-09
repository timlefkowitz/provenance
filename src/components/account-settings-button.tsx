'use client';

import { useRouter } from 'next/navigation';
import pathsConfig from '~/config/paths.config';

const SETTINGS_PATH = pathsConfig.app.profileSettings;

export function AccountSettingsButton({
  className = 'inline-flex items-center justify-center rounded-md text-sm font-serif border border-wine/30 bg-background hover:bg-wine/10 h-9 px-4',
  children = 'Account Settings',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => router.push(SETTINGS_PATH)}
    >
      {children}
    </button>
  );
}
