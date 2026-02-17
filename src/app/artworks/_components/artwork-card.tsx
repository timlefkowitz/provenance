'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, MoreVertical } from 'lucide-react';
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
import { FollowButton } from './follow-button';
import { FavoriteButton } from './favorite-button';
import { deleteArtwork } from '../[id]/_actions/delete-artwork';
import { SignInInvitationDialog } from '~/components/sign-in-invitation-dialog';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
  account_id: string;
};

export function ArtworkCard({ 
  artwork, 
  currentUserId 
}: { 
  artwork: Artwork;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showSignInDialog, setShowSignInDialog] = useState(false);
  const isOwnArtwork = currentUserId === artwork.account_id;
  const isAuthenticated = !!currentUserId;

  const handleArtworkClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setShowSignInDialog(true);
    }
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
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 border-wine/20 hover:border-wine/40 bg-white overflow-hidden h-full flex flex-col relative">
        {/* Action Buttons - Top Right */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          {/* Favorite Button - Show for all authenticated users */}
          {currentUserId && (
            <FavoriteButton 
              artworkId={artwork.id}
              currentUserId={currentUserId}
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
          onClick={handleArtworkClick}
          prefetch={true}
        >
          <div className="relative aspect-square bg-parchment overflow-hidden">
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
            onClick={handleArtworkClick}
            prefetch={true}
          >
          <h3 className="font-display font-bold text-wine text-lg mb-1 line-clamp-2 group-hover:text-wine/80 transition-colors">
            {artwork.title}
          </h3>
        </Link>
        {artwork.artist_name && (
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/artists/${artwork.account_id}`}
              className="text-ink/70 font-serif text-sm hover:text-wine/80 transition-colors"
            >
              {artwork.artist_name}
            </Link>
            {currentUserId && !isOwnArtwork && (
              <FollowButton 
                artistId={artwork.account_id}
                currentUserId={currentUserId}
              />
            )}
          </div>
        )}
      </CardHeader>
      <CardFooter className="pt-0 pb-4">
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
          <span>
            {new Date(artwork.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </CardFooter>
    </Card>
    <SignInInvitationDialog
      open={showSignInDialog}
      onOpenChange={setShowSignInDialog}
      artworkTitle={artwork.title}
    />
    </>
  );
}

