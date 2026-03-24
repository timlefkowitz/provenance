'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { createArtistClaimRequest } from '../../_actions/create-artist-claim-request';

export function ClaimAsArtistDialog({ artworkId }: { artworkId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="font-serif bg-wine text-parchment hover:bg-wine/90"
        >
          Claim as Artist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md font-serif">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Claim as artist</DialogTitle>
          <DialogDescription>
            Submit a request to the certificate owner. If they approve, we will email you a link to
            complete your Certificate of Authenticity (use the same email you enter below).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="claim-artist-email">Email for completion link</Label>
          <Input
            id="claim-artist-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="font-serif"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                console.log('[ArtistClaim] ClaimAsArtistDialog submit', { artworkId });
                const result = await createArtistClaimRequest(artworkId, email || undefined);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success('Claim submitted. The owner will review it in their portal.');
                setOpen(false);
                setEmail('');
              });
            }}
          >
            {pending ? 'Submitting…' : 'Submit claim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
