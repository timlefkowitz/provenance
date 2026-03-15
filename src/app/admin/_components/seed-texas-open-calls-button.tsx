'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { seedTexasOpenCalls } from '~/app/open-calls/_actions/seed-texas-open-calls';
import { toast } from '@kit/ui/sonner';

export function SeedTexasOpenCallsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count?: number;
    error?: string;
  } | null>(null);

  const handleSeed = async () => {
    if (
      !confirm(
        'Add 20 Texas open calls to the list? This uses the first gallery profile in the database. Existing slugs are skipped.',
      )
    ) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await seedTexasOpenCalls();
      setResult(response);
      if (response.success) {
        toast.success(`Added ${response.count} Texas open calls.`);
      } else {
        toast.error(response.error);
      }
    } catch (error) {
      console.error('[SeedTexasOpenCalls] seedTexasOpenCalls failed', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      setResult({ success: false, error: message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-4 border-double border-wine p-6 bg-parchment">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-wine mb-2">
            Seed Texas Open Calls
          </h2>
          <p className="text-ink/70 font-serif text-sm">
            Add 20 Texas-focused open calls (exhibitions, residencies, grants) to the browse list.
            Uses the first gallery profile in the database. Duplicate slugs are skipped.
          </p>
        </div>
        <Button
          onClick={handleSeed}
          disabled={isLoading}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {isLoading ? 'Adding...' : 'Add 20 Texas Open Calls'}
        </Button>
      </div>
      {result && (
        <p
          className={`font-serif text-sm ${result.success ? 'text-ink/80' : 'text-red-600'}`}
        >
          {result.success
            ? `Added ${result.count} open calls. View them at Open Calls → Browse.`
            : result.error}
        </p>
      )}
    </div>
  );
}
