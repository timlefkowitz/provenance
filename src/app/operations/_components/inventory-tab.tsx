'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import type { ArtworkLocationRow, OperationsArtworkOption } from '../page';
import { createArtworkLocation, deleteArtworkLocation, updateArtworkLocation } from '../_actions/artwork-locations';
import { LoanArtworkPicker } from './loan-artwork-picker';

const locTypes = ['storage', 'exhibition', 'loan', 'on_display', 'transport', 'studio'] as const;
const locStatuses = ['current', 'historical'] as const;

type Props = {
  locations: ArtworkLocationRow[];
  artworks: OperationsArtworkOption[];
  artworkTitleById: Map<string, string>;
};

function formatShortDate(iso: string | null) {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function InventoryTab({ locations, artworks, artworkTitleById }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ArtworkLocationRow | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [locType, setLocType] = useState<string>('storage');
  const [locName, setLocName] = useState('');
  const [room, setRoom] = useState('');
  const [shelf, setShelf] = useState('');
  const [crate, setCrate] = useState('');
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [moved, setMoved] = useState('');
  const [status, setStatus] = useState<string>('current');
  const [notes, setNotes] = useState('');
  const [pickerSeed, setPickerSeed] = useState(0);
  const defaultArt = artworks[0]?.id ?? '';

  const title = useMemo(
    () => (id: string) => artworkTitleById.get(id) ?? '—',
    [artworkTitleById],
  );

  function openCreate() {
    setEditing(null);
    setArtworkId(defaultArt);
    setLocType('storage');
    setLocName('');
    setRoom('');
    setShelf('');
    setCrate('');
    setCustName('');
    setCustEmail('');
    setMoved('');
    setStatus('current');
    setNotes('');
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function openEdit(l: ArtworkLocationRow) {
    setEditing(l);
    setArtworkId(l.artwork_id);
    setLocType(l.location_type);
    setLocName(l.location_name ?? '');
    setRoom(l.room ?? '');
    setShelf(l.shelf ?? '');
    setCrate(l.crate_label ?? '');
    setCustName(l.custodian_name ?? '');
    setCustEmail(l.custodian_email ?? '');
    setMoved(l.moved_at ?? '');
    setStatus(l.status);
    setNotes(l.notes ?? '');
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  async function submit() {
    if (!artworkId) {
      toast.error('Select an artwork.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const r = await updateArtworkLocation({
          id: editing.id,
          artwork_id: artworkId,
          location_type: locType as (typeof locTypes)[number],
          location_name: locName,
          room: room,
          shelf: shelf,
          crate_label: crate,
          custodian_name: custName,
          custodian_email: custEmail.trim() || undefined,
          moved_at: moved || null,
          status: status as (typeof locStatuses)[number],
          notes: notes,
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Location updated.');
      } else {
        const r = await createArtworkLocation({
          artwork_id: artworkId,
          location_type: locType as (typeof locTypes)[number],
          location_name: locName,
          room: room,
          shelf: shelf,
          crate_label: crate,
          custodian_name: custName,
          custodian_email: custEmail.trim() || undefined,
          moved_at: moved || undefined,
          status: status as (typeof locStatuses)[number],
          notes: notes,
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Location record saved.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!artworks.length) {
    return (
      <p className="text-ink/55 font-serif text-sm py-8">Add an artwork to track storage and locations.</p>
    );
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Current or historical object locations. Add a custodian email to link or invite them; each save records a
        location update in provenance.
      </p>
      <Button
        type="button"
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        onClick={openCreate}
        disabled={saving}
      >
        New location record
      </Button>
      {locations.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No location records yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Artwork</TableHead>
                <TableHead className="font-display text-wine">Type</TableHead>
                <TableHead className="font-display text-wine">Location</TableHead>
                <TableHead className="font-display text-wine">Custodian</TableHead>
                <TableHead className="font-display text-wine">Moved</TableHead>
                <TableHead className="font-display text-wine">Status</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-serif max-w-[8rem]">
                    {l.artwork ? (
                      <Link className="text-wine underline" href={`/artworks/${l.artwork.id}/certificate`}>
                        {l.artwork.title}
                      </Link>
                    ) : (
                      title(l.artwork_id)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-serif capitalize text-xs">
                      {l.location_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-serif text-sm max-w-[12rem]">
                    {l.location_name || '—'}
                    {l.room || l.shelf ? (
                      <div className="text-ink/50 text-xs">
                        {[l.room, l.shelf].filter(Boolean).join(' · ')}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.custodian_name || l.custodian_email ? (
                      <>
                        <div>{l.custodian_name || '—'}</div>
                        {l.custodian_email ? (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-ink/60 text-xs">{l.custodian_email}</span>
                            {l.custodian_user_id ? (
                              <Badge
                                className="border border-emerald-200 bg-emerald-100 text-[10px] text-emerald-900"
                                variant="secondary"
                              >
                                Linked
                              </Badge>
                            ) : (
                              <Badge
                                className="border border-amber-200 bg-amber-100 text-[10px] text-amber-900"
                                variant="secondary"
                              >
                                No account
                              </Badge>
                            )}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-serif text-sm">{formatShortDate(l.moved_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(l)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-700"
                        onClick={async () => {
                          if (!window.confirm('Delete this record?')) {
                            return;
                          }
                          const d0 = await deleteArtworkLocation(l.id);
                          if (!d0.success) {
                            toast.error(d0.error);
                          } else {
                            toast.success('Deleted.');
                            router.refresh();
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg font-serif border-wine/20">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              {editing ? 'Edit location record' : 'New location record'}
            </DialogTitle>
            <DialogDescription>Where the object is (or was), and optional custodian for notifications.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <LoanArtworkPicker
              key={pickerSeed}
              artworks={artworks}
              value={artworkId}
              onChange={setArtworkId}
              disabled={saving}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Location type</Label>
                <Select value={locType} onValueChange={setLocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locStatuses.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Location name</Label>
              <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Vault, gallery, etc." />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Room</Label>
                <Input value={room} onChange={(e) => setRoom(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Shelf / bay</Label>
                <Input value={shelf} onChange={(e) => setShelf(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Crate label</Label>
                <Input value={crate} onChange={(e) => setCrate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Custodian name</Label>
                <Input value={custName} onChange={(e) => setCustName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Custodian email</Label>
                <Input value={custEmail} onChange={(e) => setCustEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Moved / check date</Label>
              <Input type="date" value={moved} onChange={(e) => setMoved(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-wine text-parchment" disabled={saving} onClick={() => void submit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
