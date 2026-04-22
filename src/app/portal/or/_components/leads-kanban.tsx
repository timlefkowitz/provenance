'use client';

import { useState, useTransition, useMemo, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import {
  GripVertical,
  Plus,
  Trash2,
  LayoutGrid,
  List,
  Search,
  Mail,
  Phone,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  Users,
  UserPlus,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react';
import {
  createLead,
  updateLead,
  updateLeadStage,
  deleteLead,
  getLeadsForArtist,
} from '../_actions/leads';
import {
  getCrmMembers,
  inviteCrmMemberByEmail,
  removeCrmMember,
  updateCrmColumnLabel,
  type CrmMember,
  type ColumnLabels,
} from '../_actions/crm-members';
import {
  LEAD_STAGES,
  LEAD_SOURCES,
  STAGE_LABELS,
  STAGE_STYLES,
  type LeadStage,
  type ArtistLead,
} from '../_actions/leads-constants';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function followUpStatus(dateStr: string | null): 'overdue' | 'soon' | 'future' | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'soon';
  return 'future';
}

function FollowUpBadge({ date }: { date: string | null }) {
  const status = followUpStatus(date);
  if (!status) return null;
  const cls =
    status === 'overdue'
      ? 'text-red-600 bg-red-50 border-red-200'
      : status === 'soon'
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-slate-500 bg-slate-50 border-slate-200';
  const label = new Date(date! + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 font-serif ${cls}`}>
      <Calendar className="h-2.5 w-2.5" />
      {status === 'overdue' ? `Overdue · ${label}` : label}
    </span>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const found = LEAD_SOURCES.find((s) => s.value === source);
  return (
    <span className="inline-flex items-center text-[10px] bg-parchment border border-wine/15 rounded px-1.5 py-0.5 font-serif text-ink/60">
      {found?.label ?? source}
    </span>
  );
}

// ─── Staleness timer ─────────────────────────────────────────────────────────

type StalenessLevel = 'quiet' | 'aging' | 'stale' | 'cold';

function stalenessInfo(updatedAt: string): { label: string; level: StalenessLevel } | null {
  const diffDays = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  if (diffDays < 3) return null;
  if (diffDays < 7)  return { label: `${diffDays}d`,                       level: 'quiet' };
  if (diffDays < 14) return { label: `${Math.floor(diffDays / 7)}w`,        level: 'aging' };
  if (diffDays < 60) return { label: `${Math.floor(diffDays / 7)}w`,        level: 'stale' };
  return               { label: `${Math.floor(diffDays / 30)}mo`,           level: 'cold'  };
}

const STALENESS_CLS: Record<StalenessLevel, string> = {
  quiet: 'text-slate-400 bg-slate-50  border-slate-200',
  aging: 'text-amber-600 bg-amber-50  border-amber-200',
  stale: 'text-orange-600 bg-orange-50 border-orange-200',
  cold:  'text-red-600   bg-red-50    border-red-200',
};

function StalenessTimer({ updatedAt }: { updatedAt: string }) {
  const info = stalenessInfo(updatedAt);
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 font-serif ${STALENESS_CLS[info.level]}`}
      title={`Last updated ${new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
    >
      <Clock className="h-2.5 w-2.5" />
      {info.label}
    </span>
  );
}

// ─── Lead form (shared between add + edit) ──────────────────────────────────

function LeadForm({
  values,
  onChange,
  artistArtworks,
}: {
  values: {
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    notes: string;
    artwork_id: string;
    estimated_value: string;
    follow_up_date: string;
    source: string;
  };
  onChange: (key: string, val: string) => void;
  artistArtworks: { id: string; title: string; image_url: string | null }[];
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lf-name" className="text-xs font-serif">Name</Label>
          <Input id="lf-name" placeholder="Jane Collector" value={values.contact_name} onChange={(e) => onChange('contact_name', e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lf-source" className="text-xs font-serif">Source</Label>
          <Select value={values.source || 'none'} onValueChange={(v) => onChange('source', v === 'none' ? '' : v)}>
            <SelectTrigger id="lf-source"><SelectValue placeholder="How you met" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unknown</SelectItem>
              {LEAD_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lf-email" className="text-xs font-serif">Email</Label>
          <Input id="lf-email" type="email" placeholder="jane@example.com" value={values.contact_email} onChange={(e) => onChange('contact_email', e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lf-phone" className="text-xs font-serif">Phone</Label>
          <Input id="lf-phone" type="tel" placeholder="Optional" value={values.contact_phone} onChange={(e) => onChange('contact_phone', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lf-value" className="text-xs font-serif">Est. Value ($)</Label>
          <Input id="lf-value" type="number" min="0" placeholder="0" value={values.estimated_value} onChange={(e) => onChange('estimated_value', e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lf-followup" className="text-xs font-serif">Follow-up Date</Label>
          <Input id="lf-followup" type="date" value={values.follow_up_date} onChange={(e) => onChange('follow_up_date', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lf-artwork" className="text-xs font-serif">Interested In (Artwork)</Label>
        <Select value={values.artwork_id || 'none'} onValueChange={(v) => onChange('artwork_id', v === 'none' ? '' : v)}>
          <SelectTrigger id="lf-artwork"><SelectValue placeholder="Select artwork" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None / General inquiry</SelectItem>
            {artistArtworks.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lf-notes" className="text-xs font-serif">Notes</Label>
        <Textarea id="lf-notes" placeholder="Met at fair, interested in large works…" value={values.notes} onChange={(e) => onChange('notes', e.target.value)} rows={2} />
      </div>
    </div>
  );
}

// ─── Lead card ──────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onMove,
  onDelete,
  isDragging,
  onOpenEdit,
}: {
  lead: ArtistLead;
  onMove: (stage: LeadStage) => void;
  onDelete: () => void;
  isDragging?: boolean;
  onOpenEdit?: () => void;
}) {
  const displayName = lead.contact_name?.trim() || lead.contact_email || 'No name';
  const otherStages = LEAD_STAGES.filter((s) => s !== lead.stage);

  const openEdit = () => { if (!onOpenEdit || isDragging) return; onOpenEdit(); };
  const onEditKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openEdit();
  };

  return (
    <div
      className={[
        'rounded-lg bg-white border border-wine/15 shadow-sm transition-shadow',
        isDragging ? 'opacity-90 shadow-lg ring-2 ring-wine/20' : 'hover:shadow-md',
      ].join(' ')}
    >
      {/* Clickable body */}
      <div
        role={onOpenEdit && !isDragging ? 'button' : undefined}
        tabIndex={onOpenEdit && !isDragging ? 0 : undefined}
        className="p-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 rounded-t-lg"
        onClick={onOpenEdit && !isDragging ? openEdit : undefined}
        onKeyDown={onOpenEdit && !isDragging ? onEditKeyDown : undefined}
      >
        <p className="font-display font-semibold text-ink text-sm leading-snug line-clamp-2 break-words mb-1">
          {displayName}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-2">
          <SourceBadge source={lead.source} />
          <FollowUpBadge date={lead.follow_up_date} />
          <StalenessTimer updatedAt={lead.updated_at} />
        </div>

        {lead.contact_email && (
          <a
            href={`mailto:${lead.contact_email}`}
            className="flex items-center gap-1 text-[11px] text-wine/80 hover:text-wine hover:underline break-all mb-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="h-2.5 w-2.5 shrink-0" />
            {lead.contact_email}
          </a>
        )}

        {lead.contact_phone && (
          <p className="flex items-center gap-1 text-[11px] text-ink/50 mb-1">
            <Phone className="h-2.5 w-2.5 shrink-0" />
            {lead.contact_phone}
          </p>
        )}

        {lead.estimated_value != null && (
          <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mb-1">
            <DollarSign className="h-2.5 w-2.5 shrink-0" />
            {fmt(lead.estimated_value)}
          </p>
        )}

        {lead.artwork && (
          <Link
            href={`/artworks/${lead.artwork.id}/certificate`}
            className="flex items-center gap-1.5 mt-1 text-[11px] text-ink/60 hover:text-wine min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.artwork.image_url && (
              <span className="relative w-5 h-5 rounded overflow-hidden flex-shrink-0 bg-parchment">
                <Image src={lead.artwork.image_url} alt="" fill className="object-cover" unoptimized />
              </span>
            )}
            <span className="line-clamp-1 break-words min-w-0">{lead.artwork.title}</span>
          </Link>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-1.5 px-3 pb-2 pt-1 border-t border-wine/8">
        {otherStages.length > 0 && (
          <div className="flex-1 min-w-0">
            <Select value="" onValueChange={(v) => { if (LEAD_STAGES.includes(v as LeadStage)) onMove(v as LeadStage); }}>
              <SelectTrigger className="h-6 text-[11px] w-full border-wine/20" onClick={(e) => e.stopPropagation()}>
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {otherStages.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 ml-auto text-ink/35 hover:text-red-600 hover:bg-red-50"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Remove lead"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Draggable wrapper ───────────────────────────────────────────────────────

function SortableLeadCard({ lead, onMove, onDelete, onOpenEdit }: {
  lead: ArtistLead; onMove: (s: LeadStage) => void; onDelete: () => void; onOpenEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div ref={setNodeRef} className="touch-none">
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-0.5 text-ink/25 hover:text-wine mt-2 rounded"
          aria-label="Drag to move"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <LeadCard lead={lead} onMove={onMove} onDelete={onDelete} isDragging={isDragging} onOpenEdit={onOpenEdit} />
        </div>
      </div>
    </div>
  );
}

// ─── Droppable column ────────────────────────────────────────────────────────

function DroppableColumn({ stage, leads, onMove, onDelete, onOpenEdit, columnLabel, onRename, isOwner }: {
  stage: LeadStage; leads: ArtistLead[];
  onMove: (leadId: string, stage: LeadStage) => void;
  onDelete: (leadId: string) => void;
  onOpenEdit: (lead: ArtistLead) => void;
  columnLabel: string;
  onRename: (label: string) => void;
  isOwner: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const styles = STAGE_STYLES[stage];
  const totalValue = leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(columnLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(columnLabel); }, [columnLabel]);
  useEffect(() => { if (isEditing) inputRef.current?.select(); }, [isEditing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== columnLabel) onRename(trimmed);
    else setEditValue(columnLabel);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] flex-shrink-0 group/col">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                if (e.key === 'Escape') { setEditValue(columnLabel); setIsEditing(false); }
              }}
              className="font-display font-semibold text-ink text-sm bg-transparent border-b border-wine/40 outline-none w-32 leading-tight"
              maxLength={32}
            />
          ) : (
            <>
              <h3 className="font-display font-semibold text-ink text-sm truncate">{columnLabel}</h3>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover/col:opacity-100 transition-opacity p-0.5 text-ink/25 hover:text-wine rounded shrink-0"
                  aria-label={`Rename ${columnLabel} column`}
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
            </>
          )}
          <span className={`text-[10px] font-serif px-1.5 py-0.5 rounded-full font-medium shrink-0 ${styles.badge}`}>
            {leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-[10px] font-serif text-emerald-700 font-semibold shrink-0">{fmt(totalValue)}</span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={[
          'flex flex-col gap-2 rounded-xl border-2 p-2 min-h-[140px] transition-colors',
          isOver ? 'bg-wine/10 border-wine/30' : `${styles.col} border-transparent`,
        ].join(' ')}
      >
        {leads.map((lead) => (
          <SortableLeadCard
            key={lead.id}
            lead={lead}
            onMove={(s) => onMove(lead.id, s)}
            onDelete={() => onDelete(lead.id)}
            onOpenEdit={() => onOpenEdit(lead)}
          />
        ))}
        {leads.length === 0 && (
          <p className="text-xs text-ink/30 font-serif text-center py-6">Drop cards here</p>
        )}
      </div>
    </div>
  );
}

// ─── List view ───────────────────────────────────────────────────────────────

function ListView({ leads, onMove, onDelete, onOpenEdit, stageLabels }: {
  leads: ArtistLead[];
  onMove: (leadId: string, stage: LeadStage) => void;
  onDelete: (leadId: string) => void;
  onOpenEdit: (lead: ArtistLead) => void;
  stageLabels: Record<LeadStage, string>;
}) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-wine/15 rounded-xl">
        <p className="text-ink/40 font-serif text-sm">No contacts yet. Add your first lead above.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-wine/15 overflow-hidden">
      <table className="w-full text-sm font-serif">
        <thead>
          <tr className="bg-parchment/80 border-b border-wine/15">
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-ink/40 font-semibold">Contact</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-ink/40 font-semibold hidden md:table-cell">Stage</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-ink/40 font-semibold hidden lg:table-cell">Artwork</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-ink/40 font-semibold hidden lg:table-cell">Source</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-ink/40 font-semibold hidden md:table-cell">Follow-up</th>
            <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-ink/40 font-semibold">Value</th>
            <th className="px-4 py-2.5 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-wine/8">
          {leads.map((lead) => {
            const styles = STAGE_STYLES[lead.stage];
            const displayName = lead.contact_name?.trim() || lead.contact_email || 'No name';
            return (
              <tr key={lead.id} className="bg-white hover:bg-parchment/40 transition-colors group">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => onOpenEdit(lead)}
                  >
                    <p className="font-semibold text-ink group-hover:text-wine transition-colors text-sm">{displayName}</p>
                    {lead.contact_email && (
                      <p className="text-xs text-ink/50 mt-0.5">{lead.contact_email}</p>
                    )}
                    <div className="mt-1">
                      <StalenessTimer updatedAt={lead.updated_at} />
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
                    {stageLabels[lead.stage]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {lead.artwork ? (
                    <Link href={`/artworks/${lead.artwork.id}/certificate`} className="text-xs text-wine hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      <span className="line-clamp-1">{lead.artwork.title}</span>
                    </Link>
                  ) : <span className="text-xs text-ink/30">—</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <SourceBadge source={lead.source} />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <FollowUpBadge date={lead.follow_up_date} />
                </td>
                <td className="px-4 py-3 text-right">
                  {lead.estimated_value != null ? (
                    <span className="text-xs font-semibold text-emerald-700">{fmt(lead.estimated_value)}</span>
                  ) : <span className="text-xs text-ink/25">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-ink/50 hover:text-wine" onClick={() => onOpenEdit(lead)}>
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-ink/50 hover:text-red-600" onClick={() => onDelete(lead.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const BLANK_FORM = {
  contact_name: '', contact_email: '', contact_phone: '',
  notes: '', artwork_id: '', estimated_value: '', follow_up_date: '', source: '',
};

export function LeadsKanban({
  leads,
  setLeads,
  pendingOpenLeadId,
  onConsumedPendingOpen,
  artistArtworks,
  isOwner,
  initialCrmMembers,
  initialColumnLabels,
}: {
  leads: ArtistLead[];
  setLeads: Dispatch<SetStateAction<ArtistLead[]>>;
  pendingOpenLeadId: string | null;
  onConsumedPendingOpen: () => void;
  artistArtworks: { id: string; title: string; image_url: string | null }[];
  isOwner: boolean;
  initialCrmMembers: CrmMember[];
  initialColumnLabels: ColumnLabels;
}) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<ArtistLead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArtistLead | null>(null);
  const [formValues, setFormValues] = useState(BLANK_FORM);
  const [editValues, setEditValues] = useState(BLANK_FORM);
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Column labels (owner can customise; members see the same)
  const [columnLabels, setColumnLabels] = useState<ColumnLabels>(initialColumnLabels);
  const resolvedLabels = useMemo(
    () => LEAD_STAGES.reduce((acc, s) => ({ ...acc, [s]: columnLabels[s] || STAGE_LABELS[s] }), {} as Record<LeadStage, string>),
    [columnLabels],
  );

  // Team panel state (owner only)
  const [teamOpen, setTeamOpen] = useState(false);
  const [crmMembers, setCrmMembers] = useState<CrmMember[]>(initialCrmMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePending, setInvitePending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Pipeline stats
  const totalValue = leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
  const soldValue = leads.filter((l) => l.stage === 'sold').reduce((s, l) => s + (l.estimated_value ?? 0), 0);

  // Filtered leads
  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.contact_name?.toLowerCase().includes(q) ||
        l.contact_email?.toLowerCase().includes(q) ||
        l.notes?.toLowerCase().includes(q) ||
        l.artwork?.title?.toLowerCase().includes(q),
    );
  }, [leads, search]);

  const leadsByStage = LEAD_STAGES.reduce(
    (acc, stage) => ({ ...acc, [stage]: filtered.filter((l) => l.stage === stage) }),
    {} as Record<LeadStage, ArtistLead[]>,
  );

  // ── handlers ──

  const handleMove = (leadId: string, newStage: LeadStage) => {
    startTransition(async () => {
      const result = await updateLeadStage(leadId, newStage);
      if (result.success) {
        setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: newStage } : l));
        toast.success(`Moved to ${resolvedLabels[newStage]}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const leadId = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteLead(leadId);
      if (result.success) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        toast.success('Contact removed');
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;
    const newStage = LEAD_STAGES.includes(over.id as LeadStage)
      ? (over.id as LeadStage)
      : leads.find((l) => l.id === over.id)?.stage;
    if (newStage && newStage !== lead.stage) handleMove(lead.id, newStage);
  };

  const handleAddLead = () => {
    startTransition(async () => {
      const result = await createLead({
        contact_name:    formValues.contact_name.trim() || null,
        contact_email:   formValues.contact_email.trim() || null,
        contact_phone:   formValues.contact_phone.trim() || null,
        notes:           formValues.notes.trim() || null,
        artwork_id:      formValues.artwork_id || null,
        estimated_value: formValues.estimated_value ? parseFloat(formValues.estimated_value) : null,
        follow_up_date:  formValues.follow_up_date || null,
        source:          formValues.source || null,
      });
      if (result.success) {
        const fresh = await getLeadsForArtist();
        setLeads(fresh);
        setAddOpen(false);
        setFormValues(BLANK_FORM);
        toast.success('Contact added');
      } else {
        toast.error(result.error);
      }
    });
  };

  const openEditLead = (lead: ArtistLead) => {
    setEditLead(lead);
    setEditValues({
      contact_name:    lead.contact_name    ?? '',
      contact_email:   lead.contact_email   ?? '',
      contact_phone:   lead.contact_phone   ?? '',
      notes:           lead.notes           ?? '',
      artwork_id:      lead.artwork_id      ?? '',
      estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
      follow_up_date:  lead.follow_up_date  ?? '',
      source:          lead.source          ?? '',
    });
  };

  // Open edit dialog when a contact is clicked from the Contacts tab
  useEffect(() => {
    if (!pendingOpenLeadId) return;
    const lead = leads.find((l) => l.id === pendingOpenLeadId);
    onConsumedPendingOpen();
    if (!lead) return;
    setEditLead(lead);
    setEditValues({
      contact_name:    lead.contact_name    ?? '',
      contact_email:   lead.contact_email   ?? '',
      contact_phone:   lead.contact_phone   ?? '',
      notes:           lead.notes           ?? '',
      artwork_id:      lead.artwork_id      ?? '',
      estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
      follow_up_date:  lead.follow_up_date  ?? '',
      source:          lead.source          ?? '',
    });
  }, [pendingOpenLeadId, leads, onConsumedPendingOpen]);

  const handleEditSave = () => {
    if (!editLead) return;
    startTransition(async () => {
      const result = await updateLead(editLead.id, {
        contact_name:    editValues.contact_name.trim()    || null,
        contact_email:   editValues.contact_email.trim()   || null,
        contact_phone:   editValues.contact_phone.trim()   || null,
        notes:           editValues.notes.trim()           || null,
        artwork_id:      editValues.artwork_id             || null,
        estimated_value: editValues.estimated_value ? parseFloat(editValues.estimated_value) : null,
        follow_up_date:  editValues.follow_up_date         || null,
        source:          editValues.source                 || null,
      });
      if (result.success) {
        const fresh = await getLeadsForArtist();
        setLeads(fresh);
        setEditLead(null);
        toast.success('Contact updated');
      } else {
        toast.error(result.error);
      }
    });
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  // ── column rename handler ──

  const handleRenameColumn = async (stage: LeadStage, label: string) => {
    // Optimistic update
    setColumnLabels((prev) => ({ ...prev, [stage]: label || undefined }));
    const result = await updateCrmColumnLabel(stage, label);
    if (!result.success) {
      // Revert on error
      setColumnLabels((prev) => ({ ...prev, [stage]: initialColumnLabels[stage] }));
      toast.error(result.error ?? 'Could not save column name');
    }
  };

  // ── team handlers (owner only) ──

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInvitePending(true);
    setInviteError(null);
    const result = await inviteCrmMemberByEmail(inviteEmail);
    if (result.success) {
      setInviteEmail('');
      const fresh = await getCrmMembers();
      setCrmMembers(fresh);
      toast.success('Team member added');
    } else {
      setInviteError(result.error ?? 'Something went wrong.');
    }
    setInvitePending(false);
  };

  const handleRemoveMember = async (memberUserId: string) => {
    const result = await removeCrmMember(memberUserId);
    if (result.success) {
      setCrmMembers((prev) => prev.filter((m) => m.member_user_id !== memberUserId));
      toast.success('Team member removed');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Pipeline stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LEAD_STAGES.map((stage) => {
          const count = leads.filter((l) => l.stage === stage).length;
          const val = leads.filter((l) => l.stage === stage).reduce((s, l) => s + (l.estimated_value ?? 0), 0);
          const styles = STAGE_STYLES[stage];
          return (
            <div key={stage} className={`rounded-xl border p-4 ${styles.col}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                <p className="text-[10px] uppercase tracking-wider font-serif font-semibold text-ink/50">{resolvedLabels[stage]}</p>
              </div>
              <p className="text-2xl font-display font-bold text-ink">{count}</p>
              {val > 0 && <p className="text-xs text-emerald-700 font-serif font-semibold mt-0.5">{fmt(val)}</p>}
            </div>
          );
        })}
      </div>

      {/* Pipeline value summary */}
      {totalValue > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm font-serif text-ink/60 px-1">
          <span>Pipeline: <span className="font-semibold text-ink">{fmt(totalValue)}</span></span>
          {soldValue > 0 && <span>Closed: <span className="font-semibold text-emerald-700">{fmt(soldValue)}</span></span>}
          {totalValue > 0 && soldValue > 0 && (
            <span>Conversion: <span className="font-semibold text-ink">{Math.round((soldValue / totalValue) * 100)}%</span></span>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/35" />
          <Input
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 font-serif text-sm h-9 border-wine/20"
          />
        </div>
        <div className="flex items-center border border-wine/20 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setView('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif transition-colors ${view === 'kanban' ? 'bg-wine text-parchment' : 'text-ink/60 hover:bg-wine/10'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Board
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif transition-colors ${view === 'list' ? 'bg-wine text-parchment' : 'text-ink/60 hover:bg-wine/10'}`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>
        <Button
          className="bg-wine text-parchment hover:bg-wine/90 font-serif h-9"
          onClick={() => setAddOpen(true)}
          disabled={pending}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Contact
        </Button>
      </div>

      {/* ── Board or List ── */}
      {view === 'kanban' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis]}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {LEAD_STAGES.map((stage) => (
              <DroppableColumn
                key={stage}
                stage={stage}
                leads={leadsByStage[stage]}
                onMove={handleMove}
                onDelete={(id) => setDeleteTarget(leads.find((l) => l.id === id) ?? null)}
                onOpenEdit={openEditLead}
                columnLabel={resolvedLabels[stage]}
                onRename={(label) => handleRenameColumn(stage, label)}
                isOwner={isOwner}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead ? (
              <div className="w-[260px]">
                <LeadCard lead={activeLead} onMove={(s) => handleMove(activeLead.id, s)} onDelete={() => {}} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <ListView
          leads={filtered}
          onMove={handleMove}
          onDelete={(id) => setDeleteTarget(leads.find((l) => l.id === id) ?? null)}
          onOpenEdit={openEditLead}
          stageLabels={resolvedLabels}
        />
      )}

      {/* ── Add dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Add Contact</DialogTitle>
            <DialogDescription className="font-serif text-sm">Track a new collector or buyer lead.</DialogDescription>
          </DialogHeader>
          <LeadForm values={formValues} onChange={(k, v) => setFormValues((prev) => ({ ...prev, [k]: v }))} artistArtworks={artistArtworks} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-wine text-parchment hover:bg-wine/90"
              onClick={handleAddLead}
              disabled={pending || (!formValues.contact_name.trim() && !formValues.contact_email.trim())}
            >
              {pending ? 'Adding…' : 'Add contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={editLead !== null} onOpenChange={(open) => { if (!open) setEditLead(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Edit Contact</DialogTitle>
            <DialogDescription className="font-serif text-sm">Update contact details and deal info.</DialogDescription>
          </DialogHeader>
          <LeadForm values={editValues} onChange={(k, v) => setEditValues((prev) => ({ ...prev, [k]: v }))} artistArtworks={artistArtworks} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLead(null)}>Cancel</Button>
            <Button
              className="bg-wine text-parchment hover:bg-wine/90"
              onClick={handleEditSave}
              disabled={pending || (!editValues.contact_name.trim() && !editValues.contact_email.trim())}
            >
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove contact?</AlertDialogTitle>
            <AlertDialogDescription className="font-serif text-sm">
              This will permanently remove{' '}
              <span className="font-semibold">
                {deleteTarget?.contact_name || deleteTarget?.contact_email || 'this contact'}
              </span>{' '}
              from your CRM. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
            >
              {pending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Team panel (owners) / member notice (non-owners) ── */}
      {!isOwner && (
        <div className="flex items-center gap-2 text-[11px] font-serif text-ink/45 border border-wine/10 rounded-lg px-4 py-2.5 bg-parchment/40">
          <Users className="h-3.5 w-3.5 shrink-0" />
          You&apos;re viewing this CRM as a team member.
        </div>
      )}

      {isOwner && (
        <div className="border border-wine/15 rounded-xl overflow-hidden">
          {/* Header / toggle */}
          <button
            type="button"
            onClick={() => setTeamOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-parchment/60 hover:bg-parchment/80 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Users className="h-3.5 w-3.5 text-wine/60" />
              <span className="font-serif text-sm font-semibold text-ink">Team Access</span>
              {crmMembers.length > 0 && (
                <span className="text-[10px] bg-wine/10 text-wine/70 rounded-full px-2 py-0.5 font-serif">
                  {crmMembers.length}
                </span>
              )}
            </div>
            {teamOpen
              ? <ChevronUp className="h-3.5 w-3.5 text-ink/40" />
              : <ChevronDown className="h-3.5 w-3.5 text-ink/40" />
            }
          </button>

          {teamOpen && (
            <div className="px-5 py-4 space-y-4 bg-white">
              {/* Invite form */}
              <div className="space-y-1.5">
                <p className="text-xs font-serif text-ink/50">
                  Invite a team member by their Provenance account email. They will be able to view and edit contacts on your CRM.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/30" />
                    <Input
                      type="email"
                      placeholder="colleague@studio.com"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
                      className="pl-8 font-serif text-sm h-9 border-wine/20"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleInvite}
                    disabled={invitePending || !inviteEmail.trim()}
                    className="bg-wine text-parchment hover:bg-wine/90 font-serif h-9 shrink-0"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    {invitePending ? 'Adding…' : 'Add'}
                  </Button>
                </div>
                {inviteError && (
                  <p className="text-xs text-red-600 font-serif">{inviteError}</p>
                )}
              </div>

              {/* Member list */}
              {crmMembers.length === 0 ? (
                <p className="text-xs font-serif text-ink/35 py-2">No team members yet.</p>
              ) : (
                <ul className="divide-y divide-wine/8">
                  {crmMembers.map((m) => (
                    <li key={m.member_user_id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        {m.name && (
                          <p className="text-sm font-semibold text-ink font-serif truncate">{m.name}</p>
                        )}
                        <p className="text-xs text-ink/50 font-serif truncate">{m.email ?? m.member_user_id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.member_user_id)}
                        className="ml-3 shrink-0 p-1 rounded text-ink/30 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label="Remove team member"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
