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
import { batchSendCollectorInvites } from '../_actions/batch-send-collector-invites';
import { getEmailConfigStatus } from '../_actions/get-email-config-status';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedArtworkIds: Set<string>;
};

export function SendToCollectorDialog({ open, onOpenChange, selectedArtworkIds }: Props) {
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

  const handleSend = () => {
    console.log('[Collection] SendToCollectorDialog submit', { count });
    startTransition(async () => {
      const result = await batchSendCollectorInvites([...selectedArtworkIds], email);
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
            description: `The collector will receive a link to claim their Certificate${result.sent === 1 ? '' : 's'} of Ownership.`,
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
          <DialogTitle className="font-serif text-wine">Send Certificate of Ownership</DialogTitle>
          <DialogDescription className="font-serif text-ink/60">
            The collector receives <span className="font-semibold">one email</span> to claim their
            Certificate{count === 1 ? '' : 's'} of Ownership for{' '}
            {count === 1 ? 'this work' : `all ${count} selected works`}.{' '}
            Your Certificate{count === 1 ? '' : 's'} of Authenticity remain in your account.
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
          <Label htmlFor="collector-email" className="font-serif text-sm text-ink">
            Collector email
          </Label>
          <Input
            id="collector-email"
            type="email"
            placeholder="collector@example.com"
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
