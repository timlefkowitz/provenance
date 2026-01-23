'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { fixArtistNames } from '../_actions/fix-artist-names';

const ARTWORK_IDS = [
  '07737173-6cb6-4454-82a5-d1cf42244c97',
  'e87a0a14-c3a1-4b28-913b-5f1e7e66213e',
  'e000cae3-61a2-4c70-b65d-6f2b09267656',
  'c36e4016-6532-4da8-bef0-85755aa23d95',
];

const CORRECT_ARTIST_NAME = 'Bryan Rindfuss';

export function FixArtistNamesButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
    updatedCount?: number;
    artistAccountId?: string | null;
  } | null>(null);

  const handleFix = async () => {
    if (!confirm(`Are you sure you want to update ${ARTWORK_IDS.length} artworks to have artist name "${CORRECT_ARTIST_NAME}"?`)) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fixArtistNames(ARTWORK_IDS, CORRECT_ARTIST_NAME);
      setResult(response);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-4 border-double border-wine p-6 bg-parchment">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-wine mb-2">
            Fix Artist Names
          </h2>
          <p className="text-ink/70 font-serif text-sm mb-2">
            Fix artist names for specific artworks. This will update {ARTWORK_IDS.length} artworks to have artist name &quot;{CORRECT_ARTIST_NAME}&quot;.
          </p>
          <p className="text-ink/60 font-serif text-xs">
            Artwork IDs: {ARTWORK_IDS.join(', ')}
          </p>
        </div>
        <Button
          onClick={handleFix}
          disabled={isLoading}
          className="bg-wine text-parchment hover:bg-wine/90"
        >
          {isLoading ? 'Fixing...' : 'Fix Artist Names'}
        </Button>
      </div>

      {result && (
        <div className={`mt-4 p-4 rounded ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {result.success ? (
            <div>
              <p className="font-serif text-green-800 font-semibold">
                ✓ Successfully updated {result.updatedCount} artwork(s)
              </p>
              {result.artistAccountId && (
                <p className="font-serif text-green-700 text-sm mt-1">
                  Artist account ID: {result.artistAccountId}
                </p>
              )}
            </div>
          ) : (
            <p className="font-serif text-red-800">
              ✗ Error: {result.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

