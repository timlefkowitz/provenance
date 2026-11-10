'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import pathsConfig from '~/config/paths.config';

import { claimArtistProfile } from '~/app/profiles/_actions/claim-artist-profile';

/**
 * "This is me" on an artist profile someone else added. Sends a claim to whoever added it;
 * once they approve, the profile and its Certificates of Authenticity move to the artist.
 */
export function ThisIsMeButton({
  profileId,
  artistName,
  signedIn,
}: {
  profileId: string;
  artistName: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!signedIn) {
    const next = `/artists/${profileId}`;
    return (
      <Button asChild size="sm" className="font-serif bg-wine text-parchment hover:bg-wine/90">
        <Link href={`${pathsConfig.auth.signUp}?next=${encodeURIComponent(next)}`}>This is me</Link>
      </Button>
    );
  }

  if (sent) {
    return <p className="font-serif text-sm text-ink/70">Claim sent. You&apos;ll be notified when it&apos;s approved.</p>;
  }

  const handleClaim = () => {
    startTransition(async () => {
      const result = await claimArtistProfile(profileId, message || undefined);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSent(true);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-serif bg-wine text-parchment hover:bg-wine/90">
          This is me
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Claim {artistName}</DialogTitle>
          <DialogDescription className="font-serif">
            The person who added this profile reviews your claim. Once approved, the works and
            their Certificates of Authenticity move to your account as your own.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="this-is-me-message">How can they tell it&apos;s you? (optional)</Label>
          <Textarea
            id="this-is-me-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. my website or Instagram, or how we know each other"
            className="font-serif"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleClaim}
            disabled={isPending}
            className="bg-wine text-parchment hover:bg-wine/90"
          >
            {isPending ? 'Sending…' : 'Send claim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
