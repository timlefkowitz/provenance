'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { UserPlus, UserCheck } from 'lucide-react';
import { toggleFollow } from '../_actions/toggle-follow';
import { checkIsFollowing } from '../_actions/check-is-following';

export function FollowButton({ 
  artistId, 
  currentUserId 
}: { 
  artistId: string;
  currentUserId: string;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Check if currently following
  useEffect(() => {
    async function checkFollow() {
      const following = await checkIsFollowing(artistId, currentUserId);
      setIsFollowing(following);
      setIsLoading(false);
    }
    checkFollow();
  }, [artistId, currentUserId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      const result = await toggleFollow(artistId, currentUserId);
      if (!result.error) {
        setIsFollowing(result.isFollowing || false);
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

