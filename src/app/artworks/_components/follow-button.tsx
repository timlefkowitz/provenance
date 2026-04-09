'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { UserPlus, UserCheck } from 'lucide-react';
import { toggleFollow } from '../_actions/toggle-follow';
import { checkIsFollowing } from '../_actions/check-is-following';
import { isStaleServerActionError } from '~/lib/stale-server-action';

export function FollowButton({
  artistId,
  currentUserId,
  /** When set (e.g. server-batched portal), skip checkIsFollowing() on mount */
  initialFollowing,
}: {
  artistId: string;
  currentUserId: string;
  initialFollowing?: boolean;
}) {
  const [isFollowing, setIsFollowing] = useState(() =>
    initialFollowing !== undefined ? initialFollowing : false,
  );
  const [isLoading, setIsLoading] = useState(initialFollowing === undefined);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialFollowing !== undefined) {
      setIsFollowing(initialFollowing);
      setIsLoading(false);
      return;
    }

    async function checkFollow() {
      try {
        const following = await checkIsFollowing(artistId, currentUserId);
        setIsFollowing(following);
      } catch (error) {
        if (isStaleServerActionError(error)) {
          console.error(
            '[FollowButton] Server action missing — stale JS after deploy?',
            error,
          );
        } else {
          console.error('[FollowButton] checkIsFollowing failed', error);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void checkFollow();
  }, [artistId, currentUserId, initialFollowing]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      try {
        const result = await toggleFollow(artistId, currentUserId);
        if (!result.error) {
          setIsFollowing(result.isFollowing || false);
        }
      } catch (error) {
        if (isStaleServerActionError(error)) {
          console.error('[FollowButton] Toggle failed — stale deployment bundle', error);
          toast.error('Please refresh the page (Cmd/Ctrl+Shift+R) to sync with the site.');
        } else {
          console.error('[FollowButton] toggleFollow failed', error);
        }
      }
    });
  };

  if (isLoading) {
    return null; // or a loading skeleton
  }

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      className={`h-7 text-xs font-serif ${
        isFollowing 
          ? 'border-wine/30 text-wine hover:bg-wine/10' 
          : 'bg-wine text-parchment hover:bg-wine/90'
      }`}
      onClick={handleToggle}
      disabled={isPending}
    >
      {isFollowing ? (
        <>
          <UserCheck className="h-3 w-3 mr-1" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-3 w-3 mr-1" />
          Follow
        </>
      )}
    </Button>
  );
}

