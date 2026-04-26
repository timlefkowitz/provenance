'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@kit/ui/button';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-viewport flex flex-col items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-3xl font-display tracking-tight text-foreground">
            You&apos;re Offline
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            It looks like you&apos;ve lost your internet connection. 
            Don&apos;t worry, your collection is still safe.
          </p>
        </div>

        {/* Offline features */}
        <div className="bg-card border border-border rounded-lg p-6 text-left space-y-4">
          <h2 className="font-medium text-foreground">While offline, you can:</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-wine mt-2 shrink-0" />
              <span>Browse previously viewed artworks</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-wine mt-2 shrink-0" />
              <span>Draft new provenance entries</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-wine mt-2 shrink-0" />
              <span>Take photos for later upload</span>
            </li>
          </ul>
        </div>

        {/* Retry button */}
        <Button 
          onClick={handleRetry}
          size="lg"
          className="w-full gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>

        <p className="text-sm text-muted-foreground">
          Changes made offline will sync automatically when you reconnect.
        </p>
      </div>
    </div>
  );
}
