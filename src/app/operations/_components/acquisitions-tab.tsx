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
import type { AcquisitionRow, OperationsArtworkOption } from '../page';
import {
  createAcquisition,
  deleteAcquisition,
  duplicateAcquisition,
  updateAcquisition,
} from '../_actions/acquisitions';
import { uploadOperationsDocument } from '~/lib/operations/operations-document-upload';
import { LoanArtworkPicker } from './loan-artwork-picker';
import { Upload, X } from 'lucide-react';

const acqTypes = ['purchase', 'gift', 'bequest', 'exchange', 'transfer'] as const;
const legalStatuses = ['clear', 'under_review', 'encumbered'] as const;
const statuses = ['under_review', 'approved', 'accessioned', 'deaccessioned'] as const;

type Props = {
  acquisitions: AcquisitionRow[];
  artworks: OperationsArtworkOption[];
  artworkTitleById: Map<string, string>;
};

function money(cents: number | null, cur: string) {
  if (cents == null) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(cents / 100);
}

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

function legalBadgeClass(legal: string) {
  if (legal === 'clear') {
    return 'border border-emerald-200 bg-emerald-100 text-emerald-900';
  }
  if (legal === 'encumbered') {
    return 'border border-red-200 bg-red-100 text-red-900';
  }
  return 'border border-amber-200 bg-amber-100 text-amber-900';
}

export function AcquisitionsTab({ acquisitions, artworks, artworkTitleById }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcquisitionRow | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [acqType, setAcqType] = useState<string>('purchase');
  const [sellerName, setSellerName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [acqDate, setAcqDate] = useState('');
  const [provenanceNotes, setProvenanceNotes] = useState('');
  const [accessionNum, setAccessionNum] = useState('');
  const [legal, setLegal] = useState<string>('under_review');
  const [fundSource, setFundSource] = useState('');
  const [status, setStatus] = useState<string>('under_review');
  const [docPath, setDocPath] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pickerSeed, setPickerSeed] = useState(0);
  const defaultArt = artworks[0]?.id ?? '';

  const title = useMemo(
    () => (id: string) => artworkTitleById.get(id) ?? '—',
    [artworkTitleById],
  );

  function openCreate() {
    setEditing(null);
    setArtworkId(defaultArt);
    setAcqType('purchase');
    setSellerName('');
    setSellerEmail('');
    setPrice('');
    setCurrency('USD');
    setAcqDate('');
    setProvenanceNotes('');
    setAccessionNum('');
    setLegal('under_review');
    setFundSource('');
    setStatus('under_review');
    setDocPath(null);
    setPendingFile(null);
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function openEdit(r: AcquisitionRow) {
    setEditing(r);
    setArtworkId(r.artwork_id);
    setAcqType(r.acquisition_type);
    setSellerName(r.seller_name);
    setSellerEmail(r.seller_email ?? '');
    setPrice(
      r.acquisition_price_cents != null ? String(r.acquisition_price_cents / 100) : '',
    );
    setCurrency(r.currency);
    setAcqDate(r.acquisition_date ?? '');
    setProvenanceNotes(r.provenance_notes ?? '');
    setAccessionNum(r.accession_number ?? '');
    setLegal(r.legal_status);
    setFundSource(r.fund_source ?? '');
    setStatus(r.status);
    setDocPath(r.document_storage_path);
    setPendingFile(null);
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  async function submit() {
    if (!artworkId) {
      toast.error('Select an artwork.');
      return;
    }
    if (!sellerName.trim()) {
      toast.error('Seller name is required.');
      return;
    }
    setSaving(true);
    try {
      let path = docPath;
      if (pendingFile) {
        const fd = new FormData();
        fd.set('file', pendingFile);
        const up = await uploadOperationsDocument(fd, 'acquisitions');
        if (!up.success) {
          toast.error(up.error);
          return;
        }
        path = up.path;
        setPendingFile(null);
      }
      const priceCents =
        price === '' || Number.isNaN(Number.parseFloat(price))
          ? null
          : Math.round(Number.parseFloat(price) * 100);
      if (editing) {
        const r = await updateAcquisition({
          id: editing.id,
          artwork_id: artworkId,
          acquisition_type: acqType as (typeof acqTypes)[number],
          seller_name: sellerName.trim(),
          seller_email: sellerEmail.trim(),
          acquisition_price_cents: priceCents,
          currency: currency || 'USD',
          acquisition_date: acqDate || null,
          provenance_notes: provenanceNotes || null,
          accession_number: accessionNum || null,
          legal_status: legal as (typeof legalStatuses)[number],
          fund_source: fundSource || null,
          document_storage_path: path,
          status: status as (typeof statuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Acquisition updated.');
      } else {
        const r = await createAcquisition({
          artwork_id: artworkId,
          acquisition_type: acqType as (typeof acqTypes)[number],
          seller_name: sellerName.trim(),
          seller_email: sellerEmail.trim() || undefined,
          acquisition_price_cents: priceCents,
          currency: currency || 'USD',
          acquisition_date: acqDate || undefined,
          provenance_notes: provenanceNotes,
          accession_number: accessionNum || undefined,
          legal_status: legal as (typeof legalStatuses)[number],
          fund_source: fundSource,
          document_storage_path: path,
          status: status as (typeof statuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Acquisition created.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!artworks.length) {
    return (
      <p className="text-ink/55 font-serif text-sm py-8">Add an artwork to record acquisitions.</p>
    );
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Document accession, seller contacts, and provenance. Add a seller email to link them or send a Provenance
        invite.
      </p>
      <Button
        type="button"
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        onClick={openCreate}
        disabled={saving}
      >
        New acquisition
      </Button>
      {acquisitions.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No acquisition records yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Artwork</TableHead>
                <TableHead className="font-display text-wine">Type / seller</TableHead>
                <TableHead className="font-display text-wine">Accession</TableHead>
                <TableHead className="font-display text-wine">Legal</TableHead>
                <TableHead className="font-display text-wine">Price</TableHead>
                <TableHead className="font-display text-wine">Status</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acquisitions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-serif max-w-[8rem]">
                    {a.artwork ? (
                      <Link className="text-wine underline" href={`/artworks/${a.artwork.id}/certificate`}>
                        {a.artwork.title}
                      </Link>
                    ) : (
                      title(a.artwork_id)
                    )}
                  </TableCell>
                  <TableCell className="font-serif text-sm">
                    <div className="text-xs text-ink/50 capitalize">{a.acquisition_type.replace('_', ' ')}</div>
                    <div className="font-medium">{a.seller_name}</div>
                    {a.seller_email ? (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-ink/60 text-xs">{a.seller_email}</span>
                        {a.seller_user_id ? (
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
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink/80">
                    {a.accession_number || '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-xs font-serif capitalize ${legalBadgeClass(a.legal_status)}`}
                    >
                      {a.legal_status.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="font-serif text-sm tabular-nums whitespace-nowrap">
                    {money(a.acquisition_price_cents, a.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Badge variant="outline" className="font-serif capitalize text-xs">
                        {a.status.replace('_', ' ')}
                      </Badge>
                      {a.acquisition_date ? (
                        <div className="text-[11px] text-ink/50">Date: {formatShortDate(a.acquisition_date)}</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(a)}>
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
                          const d0 = await deleteAcquisition(a.id);
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
              {editing ? 'Edit acquisition' : 'New acquisition'}
            </DialogTitle>
            <DialogDescription>
              Accession, seller, and provenance. Set status to Accessioned to notify a linked seller and add a
              provenance event.
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
            <div className="grid gap-2">
              <Label>Acquisition type</Label>
              <Select value={acqType} onValueChange={setAcqType} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {acqTypes.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Seller name</Label>
                <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Seller email</Label>
                <Input
                  value={sellerEmail}
                  onChange={(e) => setSellerEmail(e.target.value)}
                  type="email"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Price</Label>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                  maxLength={3}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Acquisition date</Label>
                <Input type="date" value={acqDate} onChange={(e) => setAcqDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Accession number</Label>
                <Input
                  value={accessionNum}
                  onChange={(e) => setAccessionNum(e.target.value)}
                  placeholder="Museum / catalog #"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Legal status</Label>
                <Select value={legal} onValueChange={setLegal} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {legalStatuses.map((l) => (
                      <SelectItem key={l} value={l} className="capitalize">
                        {l.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Record status</Label>
                <Select value={status} onValueChange={setStatus} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fund source (optional)</Label>
              <Input
                value={fundSource}
                onChange={(e) => setFundSource(e.target.value)}
                placeholder="e.g. acquisition fund, donor"
              />
            </div>
            <div className="grid gap-2">
              <Label>Provenance notes</Label>
              <Textarea
                rows={4}
                value={provenanceNotes}
                onChange={(e) => setProvenanceNotes(e.target.value)}
                placeholder="Prior ownership narrative, research notes"
              />
            </div>
            <div className="grid gap-2">
              <Label>Document (deed, bill of sale)</Label>
              {docPath && !pendingFile ? (
                <p className="text-ink/60 text-xs break-all">On file: {docPath.split('/').pop()}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
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
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setPendingFile(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {editing ? (
            <DialogFooter className="flex-wrap sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const d0 = await duplicateAcquisition(editing.id);
                  if (!d0.success) {
                    toast.error(d0.error);
                    return;
                  }
                  toast.success('Duplicated as under review.');
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
