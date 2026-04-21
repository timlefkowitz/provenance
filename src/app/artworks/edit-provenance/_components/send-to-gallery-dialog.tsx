'use client';

import { useState, useTransition, useEffect } from 'react';
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
import { getEmailConfigStatus } from '../_actions/get-email-config-status';

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
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    void getEmailConfigStatus().then((s) => setEmailConfigured(s.configured));
  }, [open]);

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
      if (result.sent === 0) {
        toast.error('No invites sent', {
          description: result.errors[0] ?? 'Check your selection and try again.',
        });
        return;
      }
      if (result.errors.length > 0) {
        toast.warning(
          `Sent ${result.sent} of ${count}`,
          { description: result.errors.join(' ') },
        );
      } else {
        toast.success(
          `One invite email sent to ${email}`,
          {
            description: `The ${roleLabel} will receive a single message with a link to accept all ${result.sent} Certificate${result.sent === 1 ? '' : 's'} of Show.`,
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
          <DialogTitle className="font-serif text-wine">Send to {RoleLabel}</DialogTitle>
          <DialogDescription className="font-serif text-ink/60">
            The {roleLabel} receives <span className="font-semibold">one email</span> with a single
            button to accept all {count} Certificate{count === 1 ? '' : 's'} of Show. Each certificate
            links to your provenance record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {emailConfigured === false && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-serif text-amber-900"
              role="status"
            >
              Invites will be saved but emails will not be delivered until{' '}
              <code className="rounded bg-amber-100/80 px-1">RESEND_API_KEY</code> is set on the server.
            </div>
          )}
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
