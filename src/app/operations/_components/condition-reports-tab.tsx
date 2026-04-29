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
  uploadConditionReportFiles,
} from '../_actions/condition-reports';
import { LoanArtworkPicker } from './loan-artwork-picker';
import { Upload, X } from 'lucide-react';

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

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
    setPendingFiles([]);
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
    setPendingFiles([]);
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
      let pathList = paths
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (pendingFiles.length > 0) {
        const fd = new FormData();
        for (const f of pendingFiles) {
          fd.append('files', f);
        }
        const up = await uploadConditionReportFiles(fd);
        if (!up.success) {
          toast.error(up.error);
          return;
        }
        pathList = [...pathList, ...up.paths];
        setPendingFiles([]);
      }
      pathList = [...new Set(pathList)];
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
        Attach PDFs, Office documents, or images (up to 12 files, 25MB each).
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
                <TableHead className="font-display text-wine">Files</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-serif max-w-[10rem]">
                    {r.artwork ? (
                      <Link className="text-wine underline" href={`/artworks/${r.artwork.id}/certificate`}>
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
                  <TableCell className="font-serif text-sm text-ink/70">
                    {r.attachments_storage_paths?.length
                      ? `${r.attachments_storage_paths.length} attached`
                      : '—'}
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
            <DialogDescription>
              Inspection and condition text. Upload attachments or paste existing storage paths (one per line).
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
              <Label>Attachments</Label>
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-wine/25 bg-parchment/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    className="cursor-pointer font-sans text-sm file:mr-2 file:rounded file:border-0 file:bg-wine/10 file:px-2 file:py-1"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*,application/pdf"
                    multiple
                    disabled={saving}
                    onChange={(e) => {
                      const list = e.target.files;
                      if (!list?.length) {
                        return;
                      }
                      setPendingFiles((prev) => [...prev, ...Array.from(list)]);
                      e.target.value = '';
                    }}
                  />
                </div>
                <p className="text-ink/55 text-xs">
                  PDF, Word, Excel, CSV, text, or images. Files upload when you save.
                </p>
                {pendingFiles.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {pendingFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="text-ink/80 flex items-center justify-between gap-2 rounded border border-wine/10 bg-parchment px-2 py-1"
                      >
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                          <Upload className="text-wine h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                          disabled={saving}
                          aria-label="Remove file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Label className="text-ink/70 text-xs">Additional storage paths (optional, one per line)</Label>
              <Textarea
                rows={2}
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
                placeholder="e.g. condition-reports/…/file.pdf (for paths already in storage)"
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
