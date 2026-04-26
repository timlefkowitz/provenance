'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { usePWA } from './pwa-provider';
import { cn } from '@kit/ui/utils';

export function OfflineIndicator() {
  const { isOnline } = usePWA();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-0 inset-x-0 z-[200]',
        'bg-amber-500 text-amber-950',
        'flex items-center justify-center gap-2 py-2 px-4',
        'text-sm font-medium',
        'pt-safe' // iOS safe area
      )}
    >
      <WifiOff className="w-4 h-4" />
      <span>You&apos;re offline</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 p-1 rounded hover:bg-amber-400/50 transition-colors"
        aria-label="Retry connection"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
}
