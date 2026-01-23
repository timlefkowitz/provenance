'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { linkArtworksToExhibition, findArtworksForExhibition } from '../_actions/link-artworks-to-exhibition';
import { toast } from '@kit/ui/sonner';

export function LinkArtworksToExhibitionButton() {
  const [exhibitionTitle, setExhibitionTitle] = useState('JUNK CULTURE');
  const [galleryAccountId, setGalleryAccountId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    success: boolean;
    error?: string;
    exhibition?: { id: string; title: string; gallery_id: string };
    totalArtworks?: number;
    linkedArtworks?: number;
    unlinkedArtworks?: number;
    artworks?: Array<{ id: string; title: string; created_at: string }>;
  } | null>(null);
  const [linkResult, setLinkResult] = useState<{
    success: boolean;
    error?: string;
    message?: string;
    linkedCount?: number;
    duplicateCount?: number;
    exhibition?: { id: string; title: string; gallery_id: string };
  } | null>(null);

  const handleSearch = async () => {
    if (!exhibitionTitle.trim()) {
      toast.error('Please enter an exhibition title');
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setLinkResult(null);

    try {
      const result = await findArtworksForExhibition(
        exhibitionTitle.trim(),
        galleryAccountId.trim() || undefined
      );
      setSearchResult(result);
      
      if (result.success) {
        toast.success(`Found ${result.unlinkedArtworks || 0} unlinked artwork(s)`);
      } else {
        toast.error(result.error || 'Failed to search artworks');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setSearchResult({
        success: false,
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = async () => {
    if (!exhibitionTitle.trim()) {
      toast.error('Please enter an exhibition title');
      return;
    }

    if (!searchResult?.success || !searchResult.exhibition) {
      toast.error('Please search for artworks first');
      return;
    }

    setIsLinking(true);
    setLinkResult(null);

    try {
      const artworkIds = searchResult.artworks?.map(a => a.id) || [];
      const result = await linkArtworksToExhibition(
        exhibitionTitle.trim(),
        galleryAccountId.trim() || undefined,
        artworkIds.length > 0 ? artworkIds : undefined
      );
      
      setLinkResult(result);
      
      if (result.success) {
        toast.success(result.message || `Linked ${result.linkedCount || 0} artwork(s)`);
        // Refresh search results
        await handleSearch();
      } else {
        toast.error(result.error || 'Failed to link artworks');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setLinkResult({
        success: false,
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="border-4 border-double border-wine p-6 bg-parchment">
      <div className="mb-4">
        <h2 className="text-2xl font-display font-bold text-wine mb-2">
          Link Artworks to Exhibition
        </h2>
        <p className="text-ink/70 font-serif text-sm mb-4">
          Find and link artworks to an exhibition. This is useful when artworks were uploaded but not properly linked to their exhibition.
        </p>
      </div>

      <div className="space-y-4 mb-4">
        <div>
          <label className="block text-sm font-serif text-ink/70 mb-1">
            Exhibition Title
          </label>
          <Input
            type="text"
            value={exhibitionTitle}
            onChange={(e) => setExhibitionTitle(e.target.value)}
            placeholder="e.g., JUNK CULTURE"
            className="font-serif"
          />
        </div>

        <div>
          <label className="block text-sm font-serif text-ink/70 mb-1">
            Gallery Account ID (optional)
          </label>
          <Input
            type="text"
            value={galleryAccountId}
            onChange={(e) => setGalleryAccountId(e.target.value)}
            placeholder="Leave empty to use exhibition's gallery"
            className="font-serif"
          />
          <p className="text-xs text-ink/50 font-serif mt-1">
            If provided, will search for artworks from this gallery account. Otherwise uses the exhibition's gallery.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSearch}
            disabled={isSearching || isLinking}
            className="bg-wine text-parchment hover:bg-wine/90"
          >
            {isSearching ? 'Searching...' : 'Search for Artworks'}
          </Button>
        </div>
      </div>

      {searchResult && (
        <Card className="mb-4 border-wine/20">
          <CardHeader>
            <CardTitle className="font-display text-wine">
              {searchResult.success ? 'Search Results' : 'Error'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResult.success && searchResult.exhibition ? (
              <div className="space-y-3">
                <div>
                  <p className="font-serif text-ink font-semibold">Exhibition:</p>
                  <p className="font-serif text-ink/70">{searchResult.exhibition.title}</p>
                  <p className="font-serif text-ink/50 text-xs mt-1">
                    ID: {searchResult.exhibition.id}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="font-serif text-ink/70 text-sm">Total Artworks</p>
                    <p className="font-serif text-ink font-bold text-lg">
                      {searchResult.totalArtworks || 0}
                    </p>
                  </div>
                  <div>
                    <p className="font-serif text-ink/70 text-sm">Already Linked</p>
                    <p className="font-serif text-ink font-bold text-lg">
                      {searchResult.linkedArtworks || 0}
                    </p>
                  </div>
                  <div>
                    <p className="font-serif text-ink/70 text-sm">Unlinked</p>
                    <p className="font-serif text-wine font-bold text-lg">
                      {searchResult.unlinkedArtworks || 0}
                    </p>
                  </div>
                </div>
                {searchResult.artworks && searchResult.artworks.length > 0 && (
                  <div>
                    <p className="font-serif text-ink/70 text-sm font-semibold mb-2">
                      Unlinked Artworks ({searchResult.artworks.length}):
                    </p>
                    <div className="max-h-60 overflow-y-auto border border-wine/20 rounded p-2 bg-white/50">
                      <ul className="space-y-1">
                        {searchResult.artworks.slice(0, 20).map((artwork) => (
                          <li key={artwork.id} className="text-sm font-serif text-ink/70">
                            • {artwork.title || artwork.id}
                          </li>
                        ))}
                        {searchResult.artworks.length > 20 && (
                          <li className="text-xs font-serif text-ink/50 italic">
                            ... and {searchResult.artworks.length - 20} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                {searchResult.unlinkedArtworks && searchResult.unlinkedArtworks > 0 && (
                  <Button
                    onClick={handleLink}
                    disabled={isLinking || isSearching}
                    className="bg-wine text-parchment hover:bg-wine/90 w-full"
                  >
                    {isLinking ? 'Linking...' : `Link ${searchResult.unlinkedArtworks} Artwork(s)`}
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <p className="font-serif text-red-800">
                  {searchResult.error || 'Failed to search artworks'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {linkResult && (
        <Card className={`border-${linkResult.success ? 'green' : 'red'}-200`}>
          <CardHeader>
            <CardTitle className={`font-display ${linkResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {linkResult.success ? 'Success' : 'Error'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkResult.success ? (
              <div className="space-y-2">
                <p className="font-serif text-green-800 font-semibold">
                  {linkResult.message || `Linked ${linkResult.linkedCount || 0} artwork(s)`}
                </p>
                {linkResult.duplicateCount && linkResult.duplicateCount > 0 && (
                  <p className="font-serif text-green-700 text-sm">
                    {linkResult.duplicateCount} artwork(s) were already linked
                  </p>
                )}
                {linkResult.exhibition && (
                  <div className="mt-3">
                    <a
                      href={`/exhibitions/${linkResult.exhibition.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-serif text-wine underline hover:text-wine/80"
                    >
                      View Exhibition →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="font-serif text-red-800">
                {linkResult.error || 'Failed to link artworks'}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

