'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { fixGalleryNamesForToday } from '../_actions/fix-gallery-names';

const GALLERY_ACCOUNT_NAME = 'Timothy Lefkowitz';
const EXPECTED_GALLERY_PROFILE_NAME = 'FL!GHT';

export function FixGalleryNamesButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
    updatedCount?: number;
    artworks?: Array<{ id: string; title: string; created_at: string }>;
    galleryAccountId?: string;
    galleryProfileId?: string;
    galleryProfileName?: string;
    message?: string;
  } | null>(null);

  const handleFix = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fixGalleryNamesForToday(
        GALLERY_ACCOUNT_NAME,
        EXPECTED_GALLERY_PROFILE_NAME
      );
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
            Verify Gallery Names for Today
          </h2>
          <p className="text-ink/70 font-serif text-sm mb-2">
            Verify that artworks uploaded today by &quot;{GALLERY_ACCOUNT_NAME}&quot; will display as &quot;{EXPECTED_GALLERY_PROFILE_NAME}&quot; on certificates.
          </p>
          <p className="text-ink/60 font-serif text-xs">
            This checks that the gallery profile exists and finds all artworks created today. The certificate page will automatically use the gallery profile name.
          </p>
        </div>
        <Button
          onClick={handleFix}
          disabled={isLoading}
          className="bg-wine text-parchment hover:bg-wine/90"
        >
          {isLoading ? 'Checking...' : 'Verify Gallery Names'}
        </Button>
      </div>

      {result && (
        <div className={`mt-4 p-4 rounded ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {result.success ? (
            <div>
              <p className="font-serif text-green-800 font-semibold">
                ✓ {result.message || `Found ${result.updatedCount} artwork(s) created today`}
              </p>
              {result.galleryProfileName && (
                <p className="font-serif text-green-700 text-sm mt-1">
                  Gallery Profile: {result.galleryProfileName}
                </p>
              )}
              {result.galleryProfileId && (
                <p className="font-serif text-green-700 text-sm mt-1">
                  Profile ID: {result.galleryProfileId}
                </p>
              )}
              {result.artworks && result.artworks.length > 0 && (
                <div className="mt-3">
                  <p className="font-serif text-green-700 text-sm font-semibold mb-2">
                    Artworks found:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    {result.artworks.map((artwork) => (
                      <li key={artwork.id}>
                        <a
                          href={`/artworks/${artwork.id}/certificate`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-green-800"
                        >
                          {artwork.title || artwork.id}
                        </a>
                        {' '}
                        <span className="text-green-600">
                          ({new Date(artwork.created_at).toLocaleTimeString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="font-serif text-red-800 font-semibold">
                ✗ Error: {result.error}
              </p>
              {result.galleryAccountId && (
                <p className="font-serif text-red-700 text-sm mt-1">
                  Gallery Account ID: {result.galleryAccountId}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

