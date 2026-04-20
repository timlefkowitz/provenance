'use client';

import { useState, useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { batchSendArtistClaimInvites } from '../_actions/batch-send-artist-claim-invites';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedArtworkIds: Set<string>;
};

export function SendToArtistDialog({ open, onOpenChange, selectedArtworkIds }: Props) {
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  const count = selectedArtworkIds.size;

  const handleSend = () => {
    console.log('[Collection] SendToArtistDialog submit', { count });
    startTransition(async () => {
      const result = await batchSendArtistClaimInvites([...selectedArtworkIds], email);
      if (result.sent === 0) {
        toast.error(result.errors[0] ?? 'No invites sent');
        return;
      }
      if (result.errors.length > 0) {
        toast.message(
          `Sent ${result.sent} of ${count} invite${result.sent === 1 ? '' : 's'}`,
          { description: result.errors[0] },
        );
      } else {
        toast.success(
          `Invite${result.sent === 1 ? '' : 's'} sent to ${email}`,
          {
            description: `The artist will receive a link to complete their Certificate${result.sent === 1 ? '' : 's'} of Authenticity.`,
          },
        );
      }
      setEmail('');
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md font-serif">
        <DialogHeader>
          <DialogTitle className="font-serif text-wine">Send to Artist</DialogTitle>
          <DialogDescription className="font-serif text-ink/60">
            The artist will receive an email with a link to complete their Certificate
            {count === 1 ? '' : 's'} of Authenticity for the {count} selected work
            {count === 1 ? '' : 's'}, linked to your certificate{count === 1 ? '' : 's'} of show.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="artist-email" className="font-serif text-sm text-ink">
            Artist email
          </Label>
          <Input
            id="artist-email"
            type="email"
            placeholder="artist@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="font-serif"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="font-serif"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={pending || !email.includes('@')}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            {pending ? 'Sending…' : `Send invite${count === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
