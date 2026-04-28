'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { toast } from '@kit/ui/sonner';
import { X, Mail } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getFeaturedArtworksList } from '../_actions/get-featured-entry';
import { removeFeaturedArtwork, sendFeaturedNotificationsToAll } from '../_actions/manage-featured-artworks';
import { adminMonoLabel, adminPanel } from './admin-dash-tokens';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
};

export function FeaturedArtworksManager() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notifying, startNotifyTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFeaturedArtworks() {
      try {
        const result = await getFeaturedArtworksList();
        if (result.artworks) {
          setArtworks(result.artworks);
        }
      } catch (e) {
        console.error('Error loading featured artworks:', e);
        setError('Failed to load featured artworks');
      } finally {
        setLoading(false);
      }
    }
    loadFeaturedArtworks();
  }, []);

  const handleNotifyAll = () => {
    startNotifyTransition(async () => {
      try {
        const result = await sendFeaturedNotificationsToAll();
        if (result.error) {
          toast.error(result.error);
        } else {
          const parts: string[] = [];
          if (result.sent > 0) parts.push(`${result.sent} email${result.sent !== 1 ? 's' : ''} sent`);
          if (result.skipped > 0) parts.push(`${result.skipped} skipped (no email)`);
          if (result.errors > 0) parts.push(`${result.errors} failed`);
          toast.success(parts.length > 0 ? parts.join(', ') : 'Done');
        }
      } catch (e) {
        console.error('[FeaturedArtworksManager] Error sending notifications', e);
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  const handleRemove = (artworkId: string) => {
    startTransition(async () => {
      try {
        const result = await removeFeaturedArtwork(artworkId);

        if (result.error) {
          toast.error(result.error);
        } else {
          setArtworks(artworks.filter((a) => a.id !== artworkId));
          toast.success('Artwork removed from featured list');
          router.refresh();
        }
      } catch (e) {
        console.error('Error removing featured artwork:', e);
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  if (loading) {
    return (
      <Card className={adminPanel}>
        <CardContent className="p-6">
          <p className="font-mono text-sm text-slate-500">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section>
      <p className={`${adminMonoLabel} mb-3`}>featured</p>
      <Card className={adminPanel}>
        <CardHeader className="border-b border-[#1793d1]/15">
          <CardTitle className="font-mono text-lg text-[#67d4ff]">featured_artworks</CardTitle>
          <CardDescription className="font-mono text-xs text-slate-500">
            Up to 10 — homepage rotates one at random per load.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {error && (
            <Alert
              variant="destructive"
              className="mb-4 border-red-500/40 bg-red-950/40 text-red-100"
            >
              <AlertTitle className="font-mono text-sm">Error</AlertTitle>
              <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-sm text-slate-500">
                {artworks.length} of 10 in rotation
              </p>
              {artworks.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNotifyAll}
                  disabled={notifying}
                  className="gap-2 rounded-sm border-[#1793d1]/35 font-mono text-xs text-[#67d4ff] hover:bg-[#1793d1]/10"
                >
                  <Mail className="h-4 w-4" />
                  {notifying ? 'Sending…' : 'Notify all artists'}
                </Button>
              )}
            </div>

            {artworks.length === 0 ? (
              <div className="rounded-sm border border-[#1793d1]/20 bg-[#0f1318] py-8 text-center">
                <p className="font-mono text-sm text-slate-500">
                  No featured artworks — use &quot;Feature on Homepage&quot; on an artwork page.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {artworks.map((artwork) => (
                  <div
                    key={artwork.id}
                    className="relative rounded-sm border border-[#1793d1]/25 bg-[#0f1318] p-4 transition-colors hover:border-[#1793d1]/40"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemove(artwork.id)}
                      disabled={pending}
                      className="absolute right-2 top-2 z-10 rounded-sm bg-red-600/90 p-1 text-white hover:bg-red-500"
                      aria-label="Remove from featured"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <Link href={`/artworks/${artwork.id}/certificate`} className="block">
                      <div className="relative mb-3 aspect-square overflow-hidden rounded-sm bg-[#12151c]">
                        {artwork.image_url ? (
                          <Image
                            src={artwork.image_url}
                            alt={artwork.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono text-sm text-slate-600">
                            No image
                          </div>
                        )}
                      </div>
                      <h3 className="mb-1 line-clamp-2 font-mono text-sm font-medium text-[#67d4ff]">
                        {artwork.title}
                      </h3>
                      {artwork.artist_name && (
                        <p className="font-mono text-xs text-slate-500">{artwork.artist_name}</p>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
