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

import { createManagedArtist } from '~/app/profiles/_actions/create-managed-artist';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import {
  RecipientPicker,
  type RecipientValue,
} from '~/app/profiles/_components/recipient-picker';

/** Who to send the certificates to once the works are uploaded. */
export type PendingArtistHandoff = { recipientUserId: string } | { email: string };

const ADD_NEW = '__add_artist__';

/**
 * "Whose work is this?" for any role: your usual posting, or an artist you're adding work for.
 * Adding work for an artist issues Certificates of Authenticity in their name that wait for
 * them to accept (an artist already on Provenance) or claim (someone new).
 */
export function ForArtistPicker({
  ownLabel,
  artists,
  value,
  onSelect,
  onArtistAdded,
}: {
  /** Label for posting normally, e.g. "My own work" or "Posting as my gallery" */
  ownLabel: string;
  artists: UserProfile[];
  /** Selected managed artist profile id, or '' for the user's own posting */
  value: string;
  onSelect: (artist: UserProfile | null, handoff: PendingArtistHandoff | null) => void;
  onArtistAdded: (artist: UserProfile) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [existing, setExisting] = useState<RecipientValue | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = artists.find((a) => a.id === value) ?? null;
  const pickedPerson = existing?.kind === 'person' ? existing.person : null;
  const email = existing?.kind === 'email' ? existing.email.trim() : '';
  const name = pickedPerson ? pickedPerson.name : artistName.trim();

  const reset = () => {
    setArtistName('');
    setExisting(null);
  };

  const handleAdd = () => {
    if (!name) return;
    startTransition(async () => {
      const handoff: PendingArtistHandoff | null = pickedPerson
        ? { recipientUserId: pickedPerson.id }
        : email
          ? { email }
          : null;

      // Reuse an artist you already added under the same name rather than creating a twin.
      const reuse = artists.find(
        (a) => (a.managed_for_name || a.name).trim().toLowerCase() === name.toLowerCase(),
      );
      if (reuse) {
        onSelect(reuse, handoff);
        setDialogOpen(false);
        reset();
        return;
      }

      const result = await createManagedArtist({ artistName: name, artistEmail: email || undefined });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onArtistAdded(result.profile);
      onSelect(result.profile, handoff);
      setDialogOpen(false);
      reset();
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="forArtist">Whose work is this?</Label>
      <Select
        value={value || '__own__'}
        onValueChange={(next) => {
          if (next === ADD_NEW) {
            setDialogOpen(true);
            return;
          }
          onSelect(artists.find((a) => a.id === next) ?? null, null);
        }}
      >
        <SelectTrigger id="forArtist" className="font-serif">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__own__" className="font-serif">
            {ownLabel}
          </SelectItem>
          {artists.map((artist) => (
            <SelectItem key={artist.id} value={artist.id} className="font-serif">
              {artist.managed_for_name || artist.name}
              <span className="text-ink/60 ml-2 text-xs">(adding for this artist)</span>
            </SelectItem>
          ))}
          <SelectItem value={ADD_NEW} className="font-serif text-wine">
            + Add work for an artist…
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-ink/60 font-serif text-xs">
        {selected
          ? `Each work gets a Certificate of Authenticity in ${selected.managed_for_name || selected.name}'s name. They stay private until the artist accepts them. Track them under Profiles → Artists you're adding work for.`
          : 'Helping an artist get their work on Provenance? Choose "Add work for an artist".'}
      </p>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Add work for an artist</DialogTitle>
            <DialogDescription className="font-serif">
              Upload their work and details, and each piece gets a Certificate of Authenticity in
              their name. If they&apos;re on Provenance they accept it into their profile. If not,
              they can claim it when they join.
            </DialogDescription>
          </DialogHeader>

          <RecipientPicker
            id="for-artist"
            value={existing}
            onChange={setExisting}
            role="artist"
            searchLabel="Artist already on Provenance"
            emailLabel="Or, for an artist not on Provenance yet, their email (optional)"
          />

          {!pickedPerson && (
            <div className="space-y-2">
              <Label htmlFor="for-artist-name">Artist&apos;s name *</Label>
              <Input
                id="for-artist-name"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="e.g. Ana Ruiz"
                className="font-serif"
              />
              <p className="font-serif text-xs text-ink/60">
                {email
                  ? "We'll email them an invite to accept the certificates once your upload finishes."
                  : "No email? The artist can still find the profile and claim it. You'll approve the claim."}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isPending || !name}
              className="bg-wine text-parchment hover:bg-wine/90"
            >
              {isPending ? 'Adding…' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
