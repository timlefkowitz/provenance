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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Building2 } from 'lucide-react';
import { batchSendArtistClaimInvites } from '../_actions/batch-send-artist-claim-invites';
import { getEmailConfigStatus } from '../_actions/get-email-config-status';

type GalleryProfile = { id: string; name: string; role: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedArtworkIds: Set<string>;
  galleryProfiles?: GalleryProfile[];
};

export function SendToArtistDialog({ open, onOpenChange, selectedArtworkIds, galleryProfiles = [] }: Props) {
  const [email, setEmail] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(galleryProfiles[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    void getEmailConfigStatus().then((s) => setEmailConfigured(s.configured));
  }, [open]);

  const count = selectedArtworkIds.size;
  const selectedProfile = galleryProfiles.find((p) => p.id === selectedProfileId) ?? galleryProfiles[0];
  const senderName = selectedProfile?.name ?? '';

  const handleSend = () => {
    console.log('[Collection] SendToArtistDialog submit', { count, senderName });
    startTransition(async () => {
      const result = await batchSendArtistClaimInvites([...selectedArtworkIds], email, senderName || undefined);
      console.log('[Collection] SendToArtistDialog result', {
        sent: result.sent,
        errorCount: result.errors.length,
        errors: result.errors,
      });

      if (result.sent === 0) {
        // Nothing sent — show every reason so the user knows what to fix.
        toast.error('No certificates sent', {
          description: (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 font-serif text-sm">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ),
          duration: 12000,
        });
        return;
      }

      if (result.errors.length > 0) {
        // Partial success — list every skipped artwork with its reason so the
        // user understands why the email ended up with fewer works than expected.
        toast.warning(
          `Sent ${result.sent} of ${count} — ${count - result.sent} skipped`,
          {
            description: (
              <div className="font-serif text-sm">
                <p className="mb-2">
                  Email delivered with {result.sent} work{result.sent === 1 ? '' : 's'}.
                </p>
                <p className="mb-1 font-semibold">Skipped:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ),
            duration: 14000,
          },
        );
      } else {
        toast.success(
          `Invitation email sent to ${email}`,
          {
            description:
              result.sent === 1
                ? 'The artist will receive a link to complete their Certificate of Authenticity.'
                : `The artist will receive one email with a single button to accept all ${result.sent} certificates at once.`,
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
            The artist will receive <span className="font-semibold text-ink/80">one email</span> listing{' '}
            {count === 1
              ? 'the selected work'
              : `all ${count} selected works`}{' '}
            with a single button to accept{' '}
            {count === 1 ? 'their Certificate of Authenticity' : 'all certificates at once'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {emailConfigured === false && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-serif text-amber-900"
              role="status"
            >
              Invites will be saved but emails will not be delivered until{' '}
              <code className="rounded bg-amber-100/80 px-1">RESEND_API_KEY</code> is set on the server.
            </div>
          )}
          {galleryProfiles.length > 0 && (
            <div className="space-y-2">
              <Label className="font-serif text-sm text-ink">
                Sending as
              </Label>
              {galleryProfiles.length === 1 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-wine/20 bg-parchment/60 text-sm font-serif text-ink/80">
                  <Building2 className="h-3.5 w-3.5 text-wine/50 shrink-0" />
                  <span className="font-medium">{galleryProfiles[0]?.name}</span>
                  <span className="text-ink/40 text-xs capitalize">({galleryProfiles[0]?.role})</span>
                </div>
              ) : (
                <Select
                  value={selectedProfileId}
                  onValueChange={setSelectedProfileId}
                  disabled={pending}
                >
                  <SelectTrigger className="font-serif text-sm">
                    <SelectValue placeholder="Select a gallery…" />
                  </SelectTrigger>
                  <SelectContent>
                    {galleryProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id} className="font-serif text-sm">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-wine/50" />
                          {profile.name}
                          <span className="text-ink/40 text-xs capitalize">({profile.role})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
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
            {pending ? 'Sending…' : count === 1 ? 'Send invite' : `Send invite (${count} works)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
