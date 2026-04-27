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
import { createOwnerInviteFromCoa } from '~/app/claim/certificate/_actions/create-owner-invite-from-coa';

export function InviteCooFromCoaDialog({
  artworkId,
  artworkTitle,
}: {
  artworkId: string;
  artworkTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="font-serif border-wine/30 hover:bg-wine/10"
        >
          Invite owner (email)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md font-serif">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Send Certificate of Ownership</DialogTitle>
          <DialogDescription>
            The collector receives an email to claim a{' '}
            <span className="font-semibold">Certificate of Ownership</span> for &quot;{artworkTitle}
            &quot;. Your Certificate of Authenticity stays in your account — it is not transferred.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="invite-coo-email">Collector email</Label>
          <Input
            id="invite-coo-email"
            type="email"
            autoComplete="email"
            placeholder="collector@example.com"
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
                console.log('[Certificates] InviteCooFromCoaDialog submit', { artworkId });
                const result = await createOwnerInviteFromCoa(artworkId, email);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success('Invitation sent. The collector should check their email to claim.');
                setOpen(false);
                setEmail('');
              });
            }}
          >
            {pending ? 'Sending…' : 'Send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
