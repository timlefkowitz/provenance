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
import type { ConditionReportRow, LoanAgreementRow, OperationsArtworkOption, ConsignmentRow } from '../page';
import {
  createConditionReport,
  deleteConditionReport,
  updateConditionReport,
} from '../_actions/condition-reports';
import { LoanArtworkPicker } from './loan-artwork-picker';

const reportTypes = ['initial', 'return', 'periodic'] as const;
const grades = ['excellent', 'good', 'fair', 'poor'] as const;

type Props = {
  reports: ConditionReportRow[];
  loans: LoanAgreementRow[];
  consignments: ConsignmentRow[];
  artworks: OperationsArtworkOption[];
  artworkTitleById: Map<string, string>;
};

export function ConditionReportsTab({
  reports,
  loans,
  consignments,
  artworks,
  artworkTitleById,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConditionReportRow | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [loanId, setLoanId] = useState('');
  const [conId, setConId] = useState('');
  const [rType, setRType] = useState<string>('initial');
  const [grade, setGrade] = useState<string>('');
  const [description, setDescription] = useState('');
  const [inspector, setInspector] = useState('');
  const [inspDate, setInspDate] = useState('');
  const [pickerSeed, setPickerSeed] = useState(0);
  const [paths, setPaths] = useState('');

  const loanById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);
  const conById = useMemo(() => new Map(consignments.map((c) => [c.id, c])), [consignments]);
  const defaultArt = artworks[0]?.id ?? '';

  const loanOptions = useMemo(
    () => loans.filter((l) => l.artwork_id === artworkId),
    [loans, artworkId],
  );

  function openCreate() {
    setEditing(null);
    setArtworkId(defaultArt);
    setLoanId('');
    setConId('');
    setRType('initial');
    setGrade('');
    setDescription('');
    setInspector('');
    setInspDate('');
    setPaths('');
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function openEdit(r: ConditionReportRow) {
    setEditing(r);
    setArtworkId(r.artwork_id);
    setLoanId(r.loan_agreement_id ?? '');
    setConId(r.consignment_id ?? '');
    setRType(r.report_type);
    setGrade(r.condition_grade ?? '');
    setDescription(r.description ?? '');
    setInspector(r.inspector_name ?? '');
    setInspDate(r.inspection_date ?? '');
    setPaths((r.attachments_storage_paths ?? []).join('\n'));
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
      const pathList = paths
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (editing) {
        const res = await updateConditionReport({
          id: editing.id,
          artwork_id: artworkId,
          loan_agreement_id: loanId || null,
          consignment_id: conId || null,
          report_type: rType as (typeof reportTypes)[number],
          condition_grade: (grade as (typeof grades)[number] | null) || null,
          description: description || null,
          inspector_name: inspector || null,
          inspection_date: inspDate || null,
          attachments_storage_paths: pathList,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success('Report updated.');
      } else {
        const res = await createConditionReport({
          artwork_id: artworkId,
          loan_agreement_id: loanId || null,
          consignment_id: conId || null,
          report_type: rType as (typeof reportTypes)[number],
          condition_grade: (grade as (typeof grades)[number] | null) || null,
          description: description || null,
          inspector_name: inspector || null,
          inspection_date: inspDate || null,
          attachments_storage_paths: pathList,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success('Report saved.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!artworks.length) {
    return (
      <p className="text-ink/55 font-serif text-sm py-8">Add an artwork to log condition reports.</p>
    );
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Record condition at intake, on return, or on a schedule. Link to a loan or consignment when applicable.
        Storage paths are optional (upload flows can be added later).
      </p>
      <Button
        type="button"
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        onClick={openCreate}
        disabled={saving}
      >
        New report
      </Button>
      {reports.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No condition reports yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Artwork</TableHead>
                <TableHead className="font-display text-wine">Type</TableHead>
                <TableHead className="font-display text-wine">Grade</TableHead>
                <TableHead className="font-display text-wine">Date</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-serif max-w-[10rem]">
                    {r.artwork ? (
                      <Link className="text-wine underline" href={`/artworks/${r.artwork.id}`}>
                        {r.artwork.title}
                      </Link>
                    ) : (
                      artworkTitleById.get(r.artwork_id) ?? '—'
                    )}
                    {r.loan_agreement_id ? (
                      <div className="text-[11px] text-ink/50">Loan: {loanById.get(r.loan_agreement_id)?.borrower_name ?? '—'}</div>
                    ) : null}
                    {r.consignment_id ? (
                      <div className="text-[11px] text-ink/50">Consignment: {conById.get(r.consignment_id)?.consignee_name ?? '—'}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-serif capitalize text-xs">
                      {r.report_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-serif capitalize text-sm">{r.condition_grade ?? '—'}</TableCell>
                  <TableCell className="font-serif text-sm">
                    {r.inspection_date ? r.inspection_date : '—'}
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
                          if (!window.confirm('Delete this report?')) {
                            return;
                          }
                          const d = await deleteConditionReport(r.id);
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
              {editing ? 'Edit condition report' : 'New condition report'}
            </DialogTitle>
            <DialogDescription>Inspection and condition text; optional storage paths (one per line).</DialogDescription>
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
                <Label>Link loan (optional)</Label>
                <Select value={loanId || '__none__'} onValueChange={(v) => setLoanId(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {loanOptions
                      .filter((l) => l.artwork_id === artworkId)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.borrower_name} ({l.status})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Link consignment (optional)</Label>
                <Select value={conId || '__none__'} onValueChange={(v) => setConId(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {consignments
                      .filter((c) => c.artwork_id === artworkId)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.consignee_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Report type</Label>
                <Select value={rType} onValueChange={setRType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Condition grade</Label>
                <Select value={grade || '__none__'} onValueChange={(v) => setGrade(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {grades.map((g) => (
                      <SelectItem key={g} value={g} className="capitalize">
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Inspector</Label>
                <Input value={inspector} onChange={(e) => setInspector(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Inspection date</Label>
                <Input type="date" value={inspDate} onChange={(e) => setInspDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Attachment storage paths (one per line)</Label>
              <Textarea
                rows={2}
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
                placeholder="e.g. artworks/…/file.pdf"
              />
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
