'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, MoreVertical, Globe, EyeOff, Heart } from 'lucide-react';
import { Card, CardFooter, CardHeader } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import { FollowButton } from './follow-button';
import { FavoriteButton } from './favorite-button';
import { deleteArtwork } from '../[id]/_actions/delete-artwork';
import { toggleArtworkVisibility } from '../_actions/toggle-artwork-visibility';
import { getArtistPublicProfileHref } from '~/lib/artist-profile-link';

export type ArtworkCardArtwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
  account_id: string;
  artist_account_id?: string | null;
  artist_profile_id?: string | null;
  is_public?: boolean | null;
};

type Artwork = ArtworkCardArtwork;

export function ArtworkCard({
  artwork,
  currentUserId,
  initialFavorited,
  initialFollowingArtist,
  favoritesCount,
  favoritesLabel,
}: {
  artwork: Artwork;
  currentUserId?: string;
  initialFavorited?: boolean;
  initialFollowingArtist?: boolean;
  favoritesCount?: number;
  favoritesLabel?: string;
}) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [pending, startTransition] = useTransition();
  const [visibilityPending, startVisibilityTransition] = useTransition();
  const [optimisticIsPublic, setOptimisticIsPublic] = useState<boolean | null>(
    artwork.is_public ?? null,
  );
  const isOwnArtwork = currentUserId === artwork.account_id;
  const resolvedIsPublic = optimisticIsPublic ?? artwork.is_public ?? null;

  const handleToggleVisibility = (next: boolean) => {
    setOptimisticIsPublic(next);
    console.log('[Artworks] card toggle visibility', {
      artworkId: artwork.id,
      next,
    });
    startVisibilityTransition(async () => {
      try {
        const result = await toggleArtworkVisibility(artwork.id, next);
        if (!result.success) {
          throw new Error(result.error);
        }
        setOptimisticIsPublic(result.isPublic);
        toast.success(result.isPublic ? 'Artwork is now public.' : 'Artwork unlisted.');
        router.refresh();
      } catch (err) {
        console.error('[Artworks] card toggle visibility failed', err);
        setOptimisticIsPublic(artwork.is_public ?? null);
        toast.error((err as Error).message || 'Could not update visibility.');
      }
    });
  };

  const handleDelete = () => {
    setDeletePending(true);
    startTransition(async () => {
      try {
        await deleteArtwork(artwork.id);
        toast.success('Artwork deleted successfully');
        router.refresh();
      } catch (error: any) {
        console.error('Error deleting artwork:', error);
        toast.error(error.message || 'Failed to delete artwork');
        setDeletePending(false);
      }
    });
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-wine/20 hover:border-wine/40 bg-white overflow-hidden h-full flex flex-col relative">
        {/* Action Buttons - Top Right */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          {/* Favorite Button - Show for all authenticated users */}
          {currentUserId && (
            <FavoriteButton
              artworkId={artwork.id}
              currentUserId={currentUserId}
              initialFavorited={initialFavorited}
            />
          )}
          {/* Delete Menu - Only show for owners */}
          {isOwnArtwork && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-white/90 hover:bg-white border border-wine/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreVertical className="h-4 w-4 text-ink" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="font-serif">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Artwork
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display text-wine">
                        Delete Artwork
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-serif">
                        Are you sure you want to delete "{artwork.title}"? This action cannot be undone. 
                        The certificate and all associated data will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel 
                        disabled={deletePending}
                        className="font-serif"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deletePending}
                        className="bg-red-600 hover:bg-red-700 text-white font-serif"
                      >
                        {deletePending ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <Link
          href={`/artworks/${artwork.id}/certificate`}
          className="cursor-pointer"
          prefetch={false}
        >
          <div className="relative aspect-square bg-parchment overflow-hidden">
          {/* Favorites count badge — shown only in Top/Trending view */}
          {favoritesCount !== undefined && favoritesCount > 0 && (
            <div className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 border border-wine/20 px-2 py-0.5 text-xs font-serif text-wine shadow-sm">
              <Heart className="h-3 w-3 fill-wine" aria-hidden />
              {favoritesCount}
              {favoritesLabel && (
                <span className="text-ink/50 ml-0.5">{favoritesLabel}</span>
              )}
            </div>
          )}
          {artwork.image_url && !imageError ? (
            <Image
              src={artwork.image_url}
              alt={artwork.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink/30 font-serif">
              {artwork.image_url && imageError ? 'Image unavailable' : 'No Image'}
            </div>
          )}
          </div>
        </Link>
        <CardHeader className="flex-1">
          <Link
            href={`/artworks/${artwork.id}/certificate`}
            className="cursor-pointer"
            prefetch={false}
          >
          <h3 className="font-display font-bold text-wine text-lg mb-1 line-clamp-2 group-hover:text-wine/80 transition-colors">
            {artwork.title}
          </h3>
        </Link>
        {artwork.artist_name && (() => {
          const artistHref = getArtistPublicProfileHref({
            artist_account_id: artwork.artist_account_id ?? null,
            artist_profile_id: artwork.artist_profile_id ?? null,
          });
          return (
            <div className="flex items-center justify-between gap-2">
              {artistHref ? (
                <Link
                  href={artistHref}
                  className="text-ink/70 font-serif text-sm hover:text-wine/80 transition-colors"
                >
                  {artwork.artist_name}
                </Link>
              ) : (
                <span className="text-ink/70 font-serif text-sm">{artwork.artist_name}</span>
              )}
              {currentUserId && !isOwnArtwork && artwork.artist_account_id && (
                <FollowButton
                  artistId={artwork.artist_account_id}
                  currentUserId={currentUserId}
                  initialFollowing={initialFollowingArtist}
                />
              )}
            </div>
          );
        })()}
      </CardHeader>
      <CardFooter className="pt-0 pb-4 flex flex-col items-stretch gap-2">
        <div className="flex items-center justify-between w-full text-xs text-ink/50 font-serif">
          {isOwnArtwork ? (
            <span className="uppercase tracking-wider">
              {artwork.certificate_number}
            </span>
          ) : (
            <span className="uppercase tracking-wider text-ink/30">
              Certificate
            </span>
          )}
          <span suppressHydrationWarning>
            {new Date(artwork.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
        {isOwnArtwork && resolvedIsPublic !== null && (
          <div className="flex items-center justify-between gap-2 border-t border-wine/10 pt-2">
            {resolvedIsPublic ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-wine/20 bg-wine/5 px-2 py-0.5 text-[11px] font-serif text-wine">
                  <Globe className="h-3 w-3" aria-hidden />
                  Public
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={visibilityPending}
                  onClick={() => handleToggleVisibility(false)}
                  className={cn(
                    'h-7 px-2 text-[11px] font-serif text-ink/60 hover:text-ink hover:bg-wine/5',
                    visibilityPending && 'opacity-60',
                  )}
                >
                  <EyeOff className="h-3 w-3 mr-1" aria-hidden />
                  {visibilityPending ? 'Updating…' : 'Unlist'}
                </Button>
              </>
            ) : (
              <>
                <span className="text-[11px] font-serif text-ink/55">
                  Not on the public feed yet
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={visibilityPending}
                  onClick={() => handleToggleVisibility(true)}
                  className={cn(
                    'h-8 px-3 text-[11px] font-serif bg-ink text-parchment hover:bg-ink/90',
                    visibilityPending && 'opacity-60',
                  )}
                >
                  <Globe className="h-3 w-3 mr-1" aria-hidden />
                  {visibilityPending ? 'Publishing…' : 'Make public'}
                </Button>
              </>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

