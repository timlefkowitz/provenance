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
import type { InsuranceValuationRow, OperationsArtworkOption } from '../page';
import {
  createInsuranceValuation,
  deleteInsuranceValuation,
  duplicateInsuranceValuation,
  updateInsuranceValuation,
} from '../_actions/insurance-valuations';
import { uploadOperationsDocument } from '~/lib/operations/operations-document-upload';
import { LoanArtworkPicker } from './loan-artwork-picker';
import { Upload, X } from 'lucide-react';

const statuses = ['pending', 'active', 'expired', 'cancelled'] as const;

type Props = {
  rows: InsuranceValuationRow[];
  artworks: OperationsArtworkOption[];
  artworkTitleById: Map<string, string>;
};

function money(cents: number | null, cur: string) {
  if (cents == null) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(cents / 100);
}

function daysToEnd(end: string | null) {
  if (!end) {
    return null;
  }
  const d = new Date(end + 'T12:00:00');
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - n.getTime()) / (1000 * 60 * 60 * 24));
}

export function InsuranceTab({ rows, artworks, artworkTitleById }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceValuationRow | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [policyNum, setPolicyNum] = useState('');
  const [insName, setInsName] = useState('');
  const [insEmail, setInsEmail] = useState('');
  const [cover, setCover] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [apprName, setApprName] = useState('');
  const [apprEmail, setApprEmail] = useState('');
  const [apprDate, setApprDate] = useState('');
  const [polStart, setPolStart] = useState('');
  const [polEnd, setPolEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('pending');
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
    setPolicyNum('');
    setInsName('');
    setInsEmail('');
    setCover('');
    setCurrency('USD');
    setApprName('');
    setApprEmail('');
    setApprDate('');
    setPolStart('');
    setPolEnd('');
    setNotes('');
    setStatus('pending');
    setDocPath(null);
    setPendingFile(null);
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function openEdit(r: InsuranceValuationRow) {
    setEditing(r);
    setArtworkId(r.artwork_id);
    setPolicyNum(r.policy_number ?? '');
    setInsName(r.insurer_name);
    setInsEmail(r.insurer_contact_email ?? '');
    setCover(r.coverage_amount_cents != null ? String(r.coverage_amount_cents / 100) : '');
    setCurrency(r.currency);
    setApprName(r.appraiser_name ?? '');
    setApprEmail(r.appraiser_email ?? '');
    setApprDate(r.appraisal_date ?? '');
    setPolStart(r.policy_start_date ?? '');
    setPolEnd(r.policy_end_date ?? '');
    setNotes(r.valuation_notes ?? '');
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
    if (!insName.trim()) {
      toast.error('Insurer name is required.');
      return;
    }
    setSaving(true);
    try {
      let path = docPath;
      if (pendingFile) {
        const fd = new FormData();
        fd.set('file', pendingFile);
        const up = await uploadOperationsDocument(fd, 'insurance');
        if (!up.success) {
          toast.error(up.error);
          return;
        }
        path = up.path;
        setPendingFile(null);
      }
      const coverCents =
        cover === '' || Number.isNaN(Number.parseFloat(cover)) ? null : Math.round(Number.parseFloat(cover) * 100);
      if (editing) {
        const r = await updateInsuranceValuation({
          id: editing.id,
          artwork_id: artworkId,
          policy_number: policyNum,
          insurer_name: insName.trim(),
          insurer_contact_email: insEmail.trim(),
          coverage_amount_cents: coverCents,
          currency: currency || 'USD',
          appraiser_name: apprName,
          appraiser_email: apprEmail,
          appraisal_date: apprDate || null,
          policy_start_date: polStart || null,
          policy_end_date: polEnd || null,
          valuation_notes: notes || null,
          document_storage_path: path,
          status: status as (typeof statuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Record updated.');
      } else {
        const r = await createInsuranceValuation({
          artwork_id: artworkId,
          policy_number: policyNum,
          insurer_name: insName.trim(),
          insurer_contact_email: insEmail.trim() || undefined,
          coverage_amount_cents: coverCents,
          currency: currency || 'USD',
          appraiser_name: apprName,
          appraiser_email: apprEmail,
          appraisal_date: apprDate || undefined,
          policy_start_date: polStart || undefined,
          policy_end_date: polEnd || undefined,
          valuation_notes: notes,
          document_storage_path: path,
          status: status as (typeof statuses)[number],
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Record saved.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!artworks.length) {
    return (
      <p className="text-ink/55 font-serif text-sm py-8">Add an artwork to manage insurance and valuations.</p>
    );
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Policies, coverage, and appraisals. Add insurer and appraiser emails to link or invite them to the workflow.
      </p>
      <Button type="button" className="bg-wine text-parchment hover:bg-wine/90 font-serif" onClick={openCreate}>
        New record
      </Button>
      {rows.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No insurance / valuation records yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Artwork</TableHead>
                <TableHead className="font-display text-wine">Insurer</TableHead>
                <TableHead className="font-display text-wine">Appraiser</TableHead>
                <TableHead className="font-display text-wine">Coverage</TableHead>
                <TableHead className="font-display text-wine">Policy end</TableHead>
                <TableHead className="font-display text-wine">Status</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const d = daysToEnd(r.policy_end_date);
                const soon = r.status === 'active' && d != null && d >= 0 && d <= 30;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-serif max-w-[8rem]">
                      {r.artwork ? (
                        <Link className="text-wine underline" href={`/artworks/${r.artwork.id}/certificate`}>
                          {r.artwork.title}
                        </Link>
                      ) : (
                        title(r.artwork_id)
                      )}
                    </TableCell>
                    <TableCell className="font-serif text-sm">
                      <div className="font-medium">{r.insurer_name}</div>
                      {r.insurer_contact_email ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-ink/60 text-xs">{r.insurer_contact_email}</span>
                          {r.insurer_user_id ? (
                            <Badge className="border border-emerald-200 bg-emerald-100 text-[10px] text-emerald-900" variant="secondary">
                              Linked
                            </Badge>
                          ) : (
                            <Badge className="border border-amber-200 bg-amber-100 text-[10px] text-amber-900" variant="secondary">
                              No account
                            </Badge>
                          )}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-serif text-sm">
                      {r.appraiser_name || '—'}
                      {r.appraiser_email ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-ink/60 text-xs">{r.appraiser_email}</span>
                          {r.appraiser_user_id ? (
                            <Badge className="border border-emerald-200 bg-emerald-100 text-[10px] text-emerald-900" variant="secondary">
                              Linked
                            </Badge>
                          ) : (
                            <Badge className="border border-amber-200 bg-amber-100 text-[10px] text-amber-900" variant="secondary">
                              No account
                            </Badge>
                          )}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-serif text-sm tabular-nums">
                      {money(r.coverage_amount_cents, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.policy_end_date ? (
                        <span
                          className={soon ? 'text-amber-800 font-medium' : 'text-ink/80'}
                        >
                          {r.policy_end_date}
                          {soon ? ` (${d}d)` : d != null && d < 0 && r.status === 'active' ? ' (overdue review)' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-serif capitalize text-xs">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
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
                            const d0 = await deleteInsuranceValuation(r.id);
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg font-serif border-wine/20">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              {editing ? 'Edit insurance / valuation' : 'New insurance / valuation'}
            </DialogTitle>
            <DialogDescription>Policy, coverage, and appraiser. Set status to Active to notify a linked insurer.</DialogDescription>
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
                <Label>Insurer</Label>
                <Input value={insName} onChange={(e) => setInsName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Insurer email</Label>
                <Input value={insEmail} onChange={(e) => setInsEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Policy #</Label>
              <Input value={policyNum} onChange={(e) => setPolicyNum(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Coverage amount</Label>
                <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Appraiser</Label>
                <Input value={apprName} onChange={(e) => setApprName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Appraiser email</Label>
                <Input value={apprEmail} onChange={(e) => setApprEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Appraisal date</Label>
                <Input type="date" value={apprDate} onChange={(e) => setApprDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Policy start</Label>
                <Input type="date" value={polStart} onChange={(e) => setPolStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Policy end</Label>
                <Input type="date" value={polEnd} onChange={(e) => setPolEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Document (policy, appraisal)</Label>
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
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPendingFile(null)}>
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
                  const d0 = await duplicateInsuranceValuation(editing.id);
                  if (!d0.success) {
                    toast.error(d0.error);
                    return;
                  }
                  toast.success('Duplicated.');
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
