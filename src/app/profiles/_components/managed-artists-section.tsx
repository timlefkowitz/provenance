'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
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
  DialogTrigger,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { Plus } from 'lucide-react';

import { createManagedArtist } from '../_actions/create-managed-artist';
import type { UserProfile } from '../_actions/get-user-profiles';
import type { OpenHandoffInvite } from '~/lib/profile-handoff/handoff';
import { HandOffDialog } from './hand-off-dialog';
import { HandoffStatus } from './handoff-status';

/**
 * Artists the user manages (an artist manager, studio, or estate). Works posted for them get a
 * Certificate of Authenticity, not tied to a gallery or collector, which the artist accepts
 * into their own account.
 */
export function ManagedArtistsSection({
  artists,
  canCreate,
  openInvites = {},
}: {
  artists: UserProfile[];
  canCreate: boolean;
  openInvites?: Record<string, OpenHandoffInvite>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [artistEmail, setArtistEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!canCreate && artists.length === 0) return null;

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createManagedArtist({ artistName, artistEmail });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.profile.name} added`);
      setOpen(false);
      setArtistName('');
      setArtistEmail('');
      router.refresh();
    });
  };

  return (
    <Card className="mb-8 border-wine/20 bg-parchment/60">
      <CardHeader>
        <CardTitle className="font-display text-xl text-wine">Artists you&apos;re adding work for</CardTitle>
        <CardDescription className="font-serif">
          Help an artist onto Provenance: upload their work and data, and each piece gets a
          Certificate of Authenticity in the artist&apos;s name. Works stay private until the
          artist accepts them, from your invite, from their inbox if they&apos;re already on
          Provenance, or by claiming the profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {artists.length > 0 && (
          <ul className="divide-y divide-wine/10 rounded-md border border-wine/15">
            {artists.map((artist) => {
              const invite = openInvites[artist.id];
              return (
                <li
                  key={artist.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-serif text-ink truncate">{artist.name}</p>
                    <p className="font-serif text-xs text-ink/60 truncate">
                      {artist.managed_for_email || 'No artist email yet'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <HandoffStatus profileId={artist.id} invite={invite} draftLabel="Not sent yet" />
                    <Button asChild variant="outline" size="sm" className="font-serif border-wine/30">
                      <Link href={`/artworks/add?artist=${artist.id}`}>Add works</Link>
                    </Button>
                    <HandOffDialog
                      profileId={artist.id}
                      name={artist.managed_for_name || artist.name}
                      defaultEmail={invite?.email ?? artist.managed_for_email}
                      kind="artist"
                      resend={invite?.status === 'sent'}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-serif border-wine/30 hover:bg-wine/10">
                <Plus className="h-4 w-4 mr-2" />
                Add an artist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-wine">Add an artist</DialogTitle>
                <DialogDescription className="font-serif">
                  You&apos;ll post their works. Their name goes on every Certificate of Authenticity.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="managed-artist-name">Artist&apos;s name *</Label>
                  <Input
                    id="managed-artist-name"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="e.g. Ana Ruiz"
                    className="font-serif"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="managed-artist-email">Artist&apos;s email</Label>
                  <Input
                    id="managed-artist-email"
                    type="email"
                    value={artistEmail}
                    onChange={(e) => setArtistEmail(e.target.value)}
                    placeholder="artist@example.com"
                    className="font-serif"
                  />
                  <p className="font-serif text-xs text-ink/60">
                    Optional for now. You&apos;ll need it to send them their certificates.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !artistName.trim()}
                  className="bg-wine text-parchment hover:bg-wine/90"
                >
                  {isPending ? 'Adding…' : 'Add artist'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
