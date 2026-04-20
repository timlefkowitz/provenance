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

  const count = selectedArtworkIds.size;
  const selectedProfile = galleryProfiles.find((p) => p.id === selectedProfileId) ?? galleryProfiles[0];
  const senderName = selectedProfile?.name ?? '';

  const handleSend = () => {
    console.log('[Collection] SendToArtistDialog submit', { count, senderName });
    startTransition(async () => {
      const result = await batchSendArtistClaimInvites([...selectedArtworkIds], email, senderName || undefined);
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

        <div className="space-y-4 py-2">
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
            {pending ? 'Sending…' : `Send invite${count === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
