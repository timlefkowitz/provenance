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
import type { ExhibitionPlanRow, OperationsArtworkOption, UserExhibitionOption } from '../page';
import {
  createExhibitionPlan,
  deleteExhibitionPlan,
  duplicateExhibitionPlan,
  updateExhibitionPlan,
} from '../_actions/exhibition-plans';
import { uploadOperationsDocument } from '~/lib/operations/operations-document-upload';
import { LoanArtworkPicker } from './loan-artwork-picker';
import { Upload, X } from 'lucide-react';

const statuses = ['planning', 'confirmed', 'installed', 'closed', 'cancelled'] as const;

type Props = {
  plans: ExhibitionPlanRow[];
  artworks: OperationsArtworkOption[];
  artworkTitleById: Map<string, string>;
  userExhibitions: UserExhibitionOption[];
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

export function ExhibitionPlanningTab({ plans, artworks, artworkTitleById, userExhibitions }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExhibitionPlanRow | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [exhibitionId, setExhibitionId] = useState('');
  const [exTitle, setExTitle] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueLoc, setVenueLoc] = useState('');
  const [install, setInstall] = useState('');
  const [deinstall, setDeinstall] = useState('');
  const [objLabel, setObjLabel] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [lenderEmail, setLenderEmail] = useState('');
  const [curatorName, setCuratorName] = useState('');
  const [curatorEmail, setCuratorEmail] = useState('');
  const [status, setStatus] = useState<string>('planning');
  const [notes, setNotes] = useState('');
  const [docPath, setDocPath] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pickerSeed, setPickerSeed] = useState(0);
  const defaultArt = artworks[0]?.id ?? '';

  const title = useMemo(
    () => (id: string) => artworkTitleById.get(id) ?? '—',
    [artworkTitleById],
  );

  const exById = useMemo(
    () => new Map(userExhibitions.map((e) => [e.id, e] as const)),
    [userExhibitions],
  );

  function openCreate() {
    setEditing(null);
    setArtworkId(defaultArt);
    setExhibitionId('');
    setExTitle('');
    setVenueName('');
    setVenueLoc('');
    setInstall('');
    setDeinstall('');
    setObjLabel('');
    setLenderName('');
    setLenderEmail('');
    setCuratorName('');
    setCuratorEmail('');
    setStatus('planning');
    setNotes('');
    setDocPath(null);
    setPendingFile(null);
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function openEdit(p: ExhibitionPlanRow) {
    setEditing(p);
    setArtworkId(p.artwork_id);
    setExhibitionId(p.exhibition_id ?? '');
    setExTitle(p.exhibition_title ?? '');
    setVenueName(p.venue_name ?? '');
    setVenueLoc(p.venue_location ?? '');
    setInstall(p.install_date ?? '');
    setDeinstall(p.deinstall_date ?? '');
    setObjLabel(p.object_label ?? '');
    setLenderName(p.lender_name ?? '');
    setLenderEmail(p.lender_email ?? '');
    setCuratorName(p.curator_name ?? '');
    setCuratorEmail(p.curator_email ?? '');
    setStatus(p.status);
    setNotes(p.notes ?? '');
    setDocPath(p.document_storage_path);
    setPendingFile(null);
    setPickerSeed((n) => n + 1);
    setOpen(true);
  }

  function onExhibitionPicked(v: string) {
    setExhibitionId(v);
    if (v) {
      const e = exById.get(v);
      if (e) {
        setExTitle((t) => (t ? t : e.title));
        if (e.location) {
          setVenueLoc((l) => (l ? l : e.location!));
        }
      }
    }
  }

  async function submit() {
    if (!artworkId) {
      toast.error('Select an artwork.');
      return;
    }
    setSaving(true);
    try {
      let path = docPath;
      if (pendingFile) {
        const fd = new FormData();
        fd.set('file', pendingFile);
        const up = await uploadOperationsDocument(fd, 'exhibition_plans');
        if (!up.success) {
          toast.error(up.error);
          return;
        }
        path = up.path;
        setPendingFile(null);
      }
      const basePayload = {
        exhibition_title: exTitle,
        venue_name: venueName,
        venue_location: venueLoc,
        install_date: install || undefined,
        deinstall_date: deinstall || undefined,
        object_label: objLabel,
        lender_name: lenderName,
        lender_email: lenderEmail.trim() || undefined,
        curator_name: curatorName,
        curator_email: curatorEmail.trim() || undefined,
        notes: notes,
        document_storage_path: path,
        status: status as (typeof statuses)[number],
      };
      if (editing) {
        const r = await updateExhibitionPlan({
          id: editing.id,
          artwork_id: artworkId,
          exhibition_id: exhibitionId || null,
          ...basePayload,
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Plan updated.');
      } else {
        const r = await createExhibitionPlan({
          artwork_id: artworkId,
          exhibition_id: exhibitionId || undefined,
          ...basePayload,
        });
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success('Plan created.');
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!artworks.length) {
    return (
      <p className="text-ink/55 font-serif text-sm py-8">Add an artwork to build exhibition object schedules.</p>
    );
  }

  return (
    <>
      <p className="text-ink/70 font-serif text-sm max-w-3xl">
        Schedule objects for shows: optional link to an exhibition in your account, install dates, and lender/curator
        emails for invites and in-app links.
      </p>
      <Button
        type="button"
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        onClick={openCreate}
        disabled={saving}
      >
        New object plan
      </Button>
      {plans.length === 0 ? (
        <p className="text-ink/55 font-serif text-sm py-8">No exhibition object plans yet.</p>
      ) : (
        <div className="rounded-md border border-wine/15 bg-parchment/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-display text-wine">Artwork</TableHead>
                <TableHead className="font-display text-wine">Exhibition / venue</TableHead>
                <TableHead className="font-display text-wine">Install</TableHead>
                <TableHead className="font-display text-wine">Lender</TableHead>
                <TableHead className="font-display text-wine">Curator</TableHead>
                <TableHead className="font-display text-wine">Status</TableHead>
                <TableHead className="text-right font-display text-wine">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-serif max-w-[8rem]">
                    {p.artwork ? (
                      <Link className="text-wine underline" href={`/artworks/${p.artwork.id}`}>
                        {p.artwork.title}
                      </Link>
                    ) : (
                      title(p.artwork_id)
                    )}
                  </TableCell>
                  <TableCell className="font-serif text-sm">
                    {p.exhibition ? (
                      <div>
                        <div className="font-medium">{p.exhibition.title}</div>
                        {p.venue_name ? <div className="text-ink/60 text-xs">{p.venue_name}</div> : null}
                      </div>
                    ) : p.exhibition_title || p.venue_name ? (
                      <div>
                        {p.exhibition_title ? <div className="font-medium">{p.exhibition_title}</div> : null}
                        {p.venue_name ? <div className="text-ink/60 text-xs">{p.venue_name}</div> : null}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-serif text-sm whitespace-nowrap">
                    {formatShortDate(p.install_date)} → {formatShortDate(p.deinstall_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.lender_name || p.lender_email ? (
                      <>
                        <div>{p.lender_name || '—'}</div>
                        {p.lender_email ? (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-ink/60 text-xs">{p.lender_email}</span>
                            {p.lender_user_id ? (
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
                  <TableCell className="text-sm">
                    {p.curator_name || p.curator_email ? (
                      <>
                        <div>{p.curator_name || '—'}</div>
                        {p.curator_email ? (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-ink/60 text-xs">{p.curator_email}</span>
                            {p.curator_user_id ? (
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
                  <TableCell>
                    <Badge variant="outline" className="font-serif capitalize text-xs">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-700"
                        onClick={async () => {
                          if (!window.confirm('Delete this plan?')) {
                            return;
                          }
                          const d0 = await deleteExhibitionPlan(p.id);
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
              {editing ? 'Edit exhibition object plan' : 'New exhibition object plan'}
            </DialogTitle>
            <DialogDescription>
              Link an optional exhibition, set dates, and add lender/curator emails. Set status to Confirmed to notify
              a linked lender.
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
            {userExhibitions.length > 0 ? (
              <div className="grid gap-2">
                <Label>Link exhibition (optional)</Label>
                <Select value={exhibitionId || '__none__'} onValueChange={(v) => onExhibitionPicked(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (free text only)</SelectItem>
                    {userExhibitions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                        {e.start_date ? ` (${e.start_date})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Exhibition title (if not using link above)</Label>
              <Input value={exTitle} onChange={(e) => setExTitle(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Venue name</Label>
                <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Venue address / location</Label>
                <Input value={venueLoc} onChange={(e) => setVenueLoc(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Install date</Label>
                <Input type="date" value={install} onChange={(e) => setInstall(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Deinstall date</Label>
                <Input type="date" value={deinstall} onChange={(e) => setDeinstall(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Object label / position</Label>
              <Input value={objLabel} onChange={(e) => setObjLabel(e.target.value)} placeholder="e.g. Gallery 2, wall B" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Lender name</Label>
                <Input value={lenderName} onChange={(e) => setLenderName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Lender email</Label>
                <Input value={lenderEmail} onChange={(e) => setLenderEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Curator / registrar name</Label>
                <Input value={curatorName} onChange={(e) => setCuratorName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Curator email</Label>
                <Input value={curatorEmail} onChange={(e) => setCuratorEmail(e.target.value)} type="email" />
              </div>
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
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Document (loan form, object list)</Label>
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
                  const d0 = await duplicateExhibitionPlan(editing.id);
                  if (!d0.success) {
                    toast.error(d0.error);
                    return;
                  }
                  toast.success('Duplicated as planning.');
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
