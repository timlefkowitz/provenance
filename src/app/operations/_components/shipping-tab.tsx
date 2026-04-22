'use client';

import { useState, useMemo } from 'react';
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
import type { OperationsArtworkOption, ShipmentRow } from '../page';
import {
  createShipment,
  deleteShipment,
  duplicateShipment,
  updateShipment,
} from '../_actions/shipments';
import { uploadOperationsDocument } from '~/lib/operations/operations-document-upload';
import { LoanArtworkPicker } from './loan-artwork-picker';
import { Upload, X } from 'lucide-react';

const statuses = ['draft', 'booked', 'in_transit', 'delivered', 'cancelled'] as const;

type Props = {
  shipments: ShipmentRow[];
  artworks: OperationsArtworkOption[];
  artworkTitleById: Map<string, string>;
};

export function ShippingTab({ shipments, artworks, artworkTitleById }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShipmentRow | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [courierName, setCourierName] = useState('');
  const [courierEmail, setCourierEmail] = useState('');
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [estArrival, setEstArrival] = useState('');
  const [actArrival, setActArrival] = useState('');
  const [tracking, setTracking] = useState('');
  const [transitIns, setTransitIns] = useState('');
  const [transitVal, setTransitVal] = useState('');
  const [crating, setCrating] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [docPath, setDocPath] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pickerSeed, setPickerSeed] = useState(0);
  const defaultArt = artworks[0]?.id ?? '';

  const titleById = useMemo(
    () => (id: string) => artworkTitleById.get(id) ?? '—',
    [artworkTitleById],
  );

  function openCreate() {
    setEditing(null);
    setArtworkId(defaultArt);
    setCourierName('');
    setCourierEmail('');
    setOrigin('');
    setDest('');
    setShipDate('');
    setEstArrival('');
    setActArrival('');
    setTracking('');
    setTransitIns('');
    setTransitVal('');
    setCrating('');
    setStatus('draft');
    setDocPath(null);
    setPendingFile(null);
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function openEdit(s: ShipmentRow) {
    setEditing(s);
    setArtworkId(s.artwork_id);
    setCourierName(s.courier_name);
    setCourierEmail(s.courier_contact_email ?? '');
    setOrigin(s.origin_location ?? '');
    setDest(s.destination_location ?? '');
    setShipDate(s.ship_date ?? '');
    setEstArrival(s.estimated_arrival ?? '');
    setActArrival(s.actual_arrival ?? '');
    setTracking(s.tracking_number ?? '');
    setTransitIns(s.transit_insurance_policy ?? '');
    setTransitVal(
      s.transit_insurance_value_cents != null
        ? String(s.transit_insurance_value_cents / 100)
        : '',
    );
    setCrating(s.crating_notes ?? '');
    setStatus(s.status);
    setDocPath(s.document_storage_path);
    setPendingFile(null);
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  async function submit() {
    if (!artworkId) {
      toast.error('Select an artwork.');
      return;
    }
    if (!courierName.trim()) {
      toast.error('Courier name is required.');
      return;
    }
    setSaving(true);
    try {
      let path = docPath;
      if (pendingFile) {
        const fd = new FormData();
        fd.set('file', pendingFile);
        const up = await uploadOperationsDocument(fd, 'shipments');
        if (!up.success) {
          toast.error(up.error);
          return;
        }
        path = up.path;
        setPendingFile(null);
      }
      if (editing) {
        const r = await updateShipment({
          id: editing.id,
          artwork_id: artworkId,
          courier_name: courierName.trim(),
          courier_contact_email: courierEmail.trim(),
          origin_location: origin,
          destination_location: dest,
          ship_date: shipDate || null,
          estimated_arrival: estArrival || null,
          actual_arrival: actArrival || null,
          tracking_number: tracking,
          transit_insurance_policy: transitIns || null,
          transit_insurance_value_cents:
            transitVal === '' || Number.isNaN(Number.parseFloat(transitVal))
              ? null
              : Math.round(Number.parseFloat(transitVal) * 100),
          crating_notes: crating || null,
          document_storage_path: path,
          status: status as (typeof statuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Shipment updated.');
      } else {
        const r = await createShipment({
          artwork_id: artworkId,
          courier_name: courierName.trim(),
          courier_contact_email: courierEmail.trim() || undefined,
          origin_location: origin,
          destination_location: dest,
          ship_date: shipDate || undefined,
          estimated_arrival: estArrival || undefined,
          actual_arrival: actArrival || undefined,
          tracking_number: tracking,
          transit_insurance_policy: transitIns,
          transit_insurance_value_cents:
            transitVal === '' || Number.isNaN(Number.parseFloat(transitVal))
              ? null
              : Math.round(Number.parseFloat(transitVal) * 100),
          crating_notes: crating,
          document_storage_path: path,
          status: status as (typeof statuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Shipment created.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!artworks.length) {
    return (
      <p className="text-ink/55 font-serif text-sm py-8">Add an artwork to record shipments.</p>
    );
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Track couriers, destinations, and transit. Add a courier contact email to link them in Provenance or send a
        signup invite.
      </p>
      <Button
        type="button"
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        onClick={openCreate}
        disabled={saving}
      >
        New shipment
      </Button>
      {shipments.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No shipments yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Artwork</TableHead>
                <TableHead className="font-display text-wine">Courier</TableHead>
                <TableHead className="font-display text-wine">Route</TableHead>
                <TableHead className="font-display text-wine">Tracking</TableHead>
                <TableHead className="font-display text-wine">Status</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-serif max-w-[8rem]">
                    {s.artwork ? (
                      <Link className="text-wine underline" href={`/artworks/${s.artwork.id}`}>
                        {s.artwork.title}
                      </Link>
                    ) : (
                      titleById(s.artwork_id)
                    )}
                  </TableCell>
                  <TableCell className="font-serif text-sm">
                    <div className="font-medium">{s.courier_name}</div>
                    {s.courier_contact_email ? (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-ink/60">{s.courier_contact_email}</span>
                        {s.courier_user_id ? (
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
                            No account / invite
                          </Badge>
                        )}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-serif text-xs text-ink/75 max-w-[10rem]">
                    {(s.origin_location || '—') + ' → ' + (s.destination_location || '—')}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.tracking_number || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-serif capitalize text-xs">
                      {s.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(s)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-700"
                        onClick={async () => {
                          if (!window.confirm('Delete this shipment?')) {
                            return;
                          }
                          const d = await deleteShipment(s.id);
                          if (!d.success) {
                            toast.error(d.error);
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
              {editing ? 'Edit shipment' : 'New shipment'}
            </DialogTitle>
            <DialogDescription>
              Freight details and courier contact. Status &quot;In transit&quot; notifies a linked courier and records
              provenance.
            </DialogDescription>
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
                <Label>Courier name</Label>
                <Input value={courierName} onChange={(e) => setCourierName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Courier email</Label>
                <Input
                  value={courierEmail}
                  onChange={(e) => setCourierEmail(e.target.value)}
                  type="email"
                  placeholder="for linking / invite"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Origin</Label>
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Destination</Label>
                <Input value={dest} onChange={(e) => setDest(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Ship date</Label>
                <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Est. arrival</Label>
                <Input type="date" value={estArrival} onChange={(e) => setEstArrival(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Actual arrival</Label>
                <Input type="date" value={actArrival} onChange={(e) => setActArrival(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tracking #</Label>
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Transit insurance (policy / ref)</Label>
                <Input value={transitIns} onChange={(e) => setTransitIns(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Insured value (USD)</Label>
                <Input value={transitVal} onChange={(e) => setTransitVal(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Crating / special handling</Label>
              <Textarea rows={2} value={crating} onChange={(e) => setCrating(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Status {editing ? '' : '(set in transit when loaded)'}</Label>
              <Select value={status} onValueChange={setStatus} disabled={!editing && false}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Document (BOL, invoice)</Label>
              {docPath && !pendingFile ? (
                <p className="text-ink/60 text-xs break-all">On file: {docPath.split('/').pop()}</p>
              ) : null}
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  className="font-sans text-sm"
                  accept=".pdf,.doc,.docx,image/*"
                  disabled={saving}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setPendingFile(f ?? null);
                    e.target.value = '';
                  }}
                />
                {pendingFile ? (
                  <span className="text-ink/80 inline-flex items-center gap-1 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    {pendingFile.name}
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPendingFile(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {editing ? (
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const d = await duplicateShipment(editing.id);
                  if (!d.success) {
                    toast.error(d.error);
                    return;
                  }
                  toast.success('Duplicated as draft.');
                  setOpen(false);
                  router.refresh();
                }}
                disabled={saving}
              >
                Duplicate
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" className="bg-wine text-parchment" disabled={saving} onClick={() => void submit()}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          ) : (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="bg-wine text-parchment" disabled={saving} onClick={() => void submit()}>
                Save
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
