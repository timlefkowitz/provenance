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
import { batchSendGalleryCoSInvites } from '../_actions/batch-send-gallery-cos-invites';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedArtworkIds: Set<string>;
  recipientRole?: 'gallery' | 'institution';
};

export function SendToGalleryDialog({
  open,
  onOpenChange,
  selectedArtworkIds,
  recipientRole = 'gallery',
}: Props) {
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  const count = selectedArtworkIds.size;
  const roleLabel = recipientRole === 'institution' ? 'institution' : 'gallery';
  const RoleLabel = recipientRole === 'institution' ? 'Institution' : 'Gallery';

  const handleSend = () => {
    console.log('[Collection] SendToGalleryDialog submit', { count, recipientRole });
    startTransition(async () => {
      const result = await batchSendGalleryCoSInvites(
        [...selectedArtworkIds],
        email,
        recipientRole,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Invite${result.sent === 1 ? '' : 's'} sent to ${email}`,
        {
          description: `The ${roleLabel} will receive a link to create Certificate${result.sent === 1 ? '' : 's'} of Show linked to your provenance record${result.sent === 1 ? '' : 's'}.`,
        },
      );
      setEmail('');
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md font-serif">
        <DialogHeader>
          <DialogTitle className="font-serif text-wine">Send to {RoleLabel}</DialogTitle>
          <DialogDescription className="font-serif text-ink/60">
            The {roleLabel} will receive an email to create Certificate{count === 1 ? '' : 's'} of
            Show for the {count} selected work{count === 1 ? '' : 's'}. Each certificate will be
            linked to your provenance record, creating a verified chain of custody.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="gallery-email" className="font-serif text-sm text-ink">
            {RoleLabel} email
          </Label>
          <Input
            id="gallery-email"
            type="email"
            placeholder={`${roleLabel}@example.com`}
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
