'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from '@kit/ui/sonner';
import { Send } from 'lucide-react';

import { sendProfileHandoff } from '../_actions/send-profile-handoff';
import { RecipientPicker, type RecipientValue } from './recipient-picker';

/**
 * Send a managed profile to the person it belongs to: someone on Provenance picked by name,
 * or an email address for someone who isn't on it yet.
 */
export function HandOffDialog({
  profileId,
  name,
  defaultEmail,
  kind,
  resend,
}: {
  profileId: string;
  name: string;
  defaultEmail: string | null | undefined;
  kind: 'artist' | 'collection';
  /** An invite is already out; the button reads "Resend" */
  resend?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<RecipientValue | null>(
    defaultEmail ? { kind: 'email', email: defaultEmail } : null,
  );
  const [isPending, startTransition] = useTransition();

  const isArtist = kind === 'artist';
  const ready =
    recipient?.kind === 'person' || (recipient?.kind === 'email' && recipient.email.trim().length > 0);

  const handleSend = () => {
    if (!recipient) return;
    startTransition(async () => {
      const result = await sendProfileHandoff(
        profileId,
        recipient.kind === 'person' ? { recipientUserId: recipient.person.id } : { email: recipient.email },
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sent to ${result.recipientName ?? result.email ?? 'them'}`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-serif bg-wine text-parchment hover:bg-wine/90">
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {resend ? 'Resend' : isArtist ? 'Send to artist' : 'Hand over'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            {isArtist ? `Send ${name} their certificates` : `Hand over ${name}`}
          </DialogTitle>
          <DialogDescription className="font-serif">
            {isArtist
              ? 'They review the Certificates of Authenticity you posted and accept or decline. If they accept, the works join their artist profile as their own and you can no longer edit them.'
              : 'They review the collection and accept or decline. If they accept, every work and Certificate of Ownership moves to their account and you can no longer edit them.'}
          </DialogDescription>
        </DialogHeader>
        <RecipientPicker
          id={`handoff-${profileId}`}
          value={recipient}
          onChange={setRecipient}
          role={isArtist ? 'artist' : 'any'}
          searchLabel={isArtist ? 'Artist already on Provenance' : 'Owner already on Provenance'}
          emailLabel={isArtist ? "Or the artist's email" : "Or the owner's email"}
        />
        {resend && (
          <p className="font-serif text-xs text-ink/60">Sending again replaces the earlier invite.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending || !ready}
            className="bg-wine text-parchment hover:bg-wine/90"
          >
            {isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
