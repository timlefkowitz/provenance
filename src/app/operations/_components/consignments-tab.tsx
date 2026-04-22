'use client';

import { useState } from 'react';
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
import type { ConsignmentRow, OperationsArtworkOption } from '../page';
import {
  createConsignment,
  deleteConsignment,
  duplicateConsignment,
  updateConsignment,
} from '../_actions/consignments';
import { LoanArtworkPicker } from './loan-artwork-picker';

const consignmentStatuses = ['draft', 'active', 'expired', 'returned', 'sold'] as const;

type Props = {
  consignments: ConsignmentRow[];
  artworks: OperationsArtworkOption[];
  artworkTitleById: Map<string, string>;
};

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoneyCents(cents: number | null) {
  if (cents == null) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function ConsignmentsTab({ consignments, artworks, artworkTitleById }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsignmentRow | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [consigneeName, setConsigneeName] = useState('');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [bps, setBps] = useState('');
  const [reserve, setReserve] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [salePrice, setSalePrice] = useState('');
  const [pickerSeed, setPickerSeed] = useState(0);

  const defaultArt = artworks[0]?.id ?? '';

  function openCreate() {
    setEditing(null);
    setArtworkId(defaultArt);
    setConsigneeName('');
    setConsigneeEmail('');
    setStart('');
    setEnd('');
    setBps('');
    setReserve('');
    setTerms('');
    setNotes('');
    setStatus('draft');
    setSalePrice('');
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function openEdit(row: ConsignmentRow) {
    setEditing(row);
    setArtworkId(row.artwork_id);
    setConsigneeName(row.consignee_name);
    setConsigneeEmail(row.consignee_email ?? '');
    setStart(row.start_date ?? '');
    setEnd(row.end_date ?? '');
    setBps(row.commission_rate_bps != null ? String(row.commission_rate_bps) : '');
    setReserve(
      row.reserve_price_cents != null ? String((row.reserve_price_cents / 100).toFixed(2)) : '',
    );
    setTerms(row.terms_text ?? '');
    setNotes(row.notes ?? '');
    setStatus(row.status);
    setSalePrice(
      row.sale_price_cents != null ? String((row.sale_price_cents / 100).toFixed(2)) : '',
    );
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      if (!artworkId) {
        toast.error('Select an artwork.');
        return;
      }
      if (!consigneeName.trim()) {
        toast.error('Consignee name is required.');
        return;
      }
      const bpsNum = bps.trim() ? Math.round(Number(bps)) : null;
      if (bps.trim() && (!Number.isFinite(bpsNum) || bpsNum! < 0 || bpsNum! > 100_000)) {
        toast.error('Commission (basis points) should be 0–100000.');
        return;
      }
      const reserveCents = reserve.trim()
        ? Math.round(parseFloat(reserve) * 100)
        : null;
      if (reserve.trim() && (reserveCents == null || reserveCents < 0 || !Number.isFinite(reserveCents))) {
        toast.error('Reserve should be a valid amount.');
        return;
      }
      if (editing) {
        const payload: Record<string, unknown> = {
          id: editing.id,
          artwork_id: artworkId,
          consignee_name: consigneeName.trim(),
          consignee_email: consigneeEmail.trim(),
          start_date: start,
          end_date: end,
          commission_rate_bps: bpsNum,
          reserve_price_cents: reserveCents,
          terms_text: terms,
          notes: notes,
          status: status as (typeof consignmentStatuses)[number],
        };
        if (status === 'sold') {
          const sc = salePrice.trim() ? Math.round(parseFloat(salePrice) * 100) : 0;
          if (!Number.isFinite(sc) || sc < 0) {
            toast.error('Valid sale price is required when status is sold.');
            return;
          }
          payload.sale_price_cents = sc;
        }
        const res = await updateConsignment(payload as Parameters<typeof updateConsignment>[0]);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success('Consignment updated.');
      } else {
        const res = await createConsignment({
          artwork_id: artworkId,
          consignee_name: consigneeName.trim(),
          consignee_email: consigneeEmail.trim(),
          start_date: start,
          end_date: end,
          commission_rate_bps: bpsNum ?? undefined,
          reserve_price_cents: reserveCents ?? undefined,
          terms_text: terms,
          notes: notes,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success('Consignment created.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!consignments.length && !artworks.length) {
    return (
      <p className="text-ink/55 font-serif text-sm py-8">Add an artwork to create consignments.</p>
    );
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Track works out on consignment: consignee, terms, end dates, commission, and reserve. Mark sold to record a
        provenance ownership event.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          disabled={!artworks.length || saving}
          onClick={openCreate}
        >
          New consignment
        </Button>
      </div>
      {consignments.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No consignments yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-hidden" id="consignments">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Artwork</TableHead>
                <TableHead className="font-display text-wine">Consignee</TableHead>
                <TableHead className="font-display text-wine">Period</TableHead>
                <TableHead className="font-display text-wine">Status</TableHead>
                <TableHead className="font-display text-wine">Reserve</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consignments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-serif max-w-[10rem]">
                    {row.artwork ? (
                      <Link href={`/artworks/${row.artwork.id}`} className="text-wine underline">
                        {row.artwork.title}
                      </Link>
                    ) : (
                      artworkTitleById.get(row.artwork_id) ?? '—'
                    )}
                  </TableCell>
                  <TableCell className="font-serif">
                    <div className="font-medium">{row.consignee_name}</div>
                    {row.consignee_email ? (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-ink/60">{row.consignee_email}</span>
                        {row.consignee_user_id ? (
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
                  <TableCell className="font-serif text-sm whitespace-nowrap">
                    {formatShortDate(row.start_date)} → {formatShortDate(row.end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-serif capitalize">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-serif text-sm">
                    {formatMoneyCents(row.reserve_price_cents)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-serif"
                        onClick={() => openEdit(row)}
                        disabled={saving}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-serif"
                        disabled={saving}
                        onClick={async () => {
                          const res = await duplicateConsignment(row.id);
                          if (!res.success) {
                            toast.error(res.error);
                          } else {
                            toast.success('Duplicated as draft.');
                            router.refresh();
                          }
                        }}
                      >
                        Duplicate
                      </Button>
                      {row.status === 'draft' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="font-serif"
                          onClick={async () => {
                            const res = await updateConsignment({ id: row.id, status: 'active' });
                            if (!res.success) {
                              toast.error(res.error);
                            } else {
                              toast.success('Marked active.');
                              router.refresh();
                            }
                          }}
                        >
                          Activate
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" size="sm" className="font-serif" asChild>
                        <a
                          href={`/api/operations/consignments/${row.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      </Button>
                      {row.status === 'draft' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-700"
                          onClick={async () => {
                            if (!window.confirm('Delete this draft?')) {
                              return;
                            }
                            const r = await deleteConsignment(row.id);
                            if (!r.success) {
                              toast.error(r.error);
                            } else {
                              toast.success('Deleted.');
                              router.refresh();
                            }
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
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
              {editing ? 'Edit consignment' : 'New consignment'}
            </DialogTitle>
            <DialogDescription>Terms, schedule, and pricing for the consignee.</DialogDescription>
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
                <Label>Consignee</Label>
                <Input value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Consignee email</Label>
                <Input
                  value={consigneeEmail}
                  onChange={(e) => setConsigneeEmail(e.target.value)}
                  type="email"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Start</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Commission (basis points)</Label>
                <Input
                  value={bps}
                  onChange={(e) => setBps(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 5000 = 50%"
                />
              </div>
              <div className="grid gap-2">
                <Label>Reserve (USD)</Label>
                <Input
                  value={reserve}
                  onChange={(e) => setReserve(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Terms</Label>
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {editing ? (
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {consignmentStatuses.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {status === 'sold' ? (
                  <div className="grid gap-2">
                    <Label>Sale price (USD)</Label>
                    <Input
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
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
