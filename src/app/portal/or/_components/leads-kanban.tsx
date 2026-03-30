'use client';

import { useState, useTransition } from 'react';
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
import { Card, CardContent } from '@kit/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  createLead,
  updateLead,
  updateLeadStage,
  deleteLead,
  getLeadsForArtist,
} from '../_actions/leads';
import { LEAD_STAGES, type LeadStage, type ArtistLead } from '../_actions/leads-constants';

const STAGE_LABELS: Record<LeadStage, string> = {
  interested: 'Interested',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  sold: 'Sold',
};

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
  const displayName =
    lead.contact_name?.trim() || lead.contact_email || 'No name';
  const otherStages = LEAD_STAGES.filter((s) => s !== lead.stage);

  const openEdit = () => {
    if (!onOpenEdit || isDragging) return;
    onOpenEdit();
  };

  const onEditKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openEdit();
  };

  return (
    <Card
      className={`border-wine/20 bg-white shadow-sm transition-shadow ${isDragging ? 'opacity-90 shadow-lg ring-2 ring-wine/30' : ''}`}
    >
      <CardContent className="p-3">
        <div className="flex flex-col gap-2 min-w-0">
          <div
            role={onOpenEdit && !isDragging ? 'button' : undefined}
            tabIndex={onOpenEdit && !isDragging ? 0 : undefined}
            className={
              onOpenEdit && !isDragging
                ? 'rounded-md -m-0.5 p-0.5 min-w-0 cursor-pointer hover:bg-wine/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/30'
                : 'min-w-0'
            }
            onClick={onOpenEdit && !isDragging ? openEdit : undefined}
            onKeyDown={onOpenEdit && !isDragging ? onEditKeyDown : undefined}
          >
            <p
              className="font-display font-semibold text-wine text-base leading-snug line-clamp-2 break-words"
              title={displayName}
            >
              {displayName}
            </p>
            {lead.contact_email && (
              <a
                href={`mailto:${lead.contact_email}`}
                className="text-xs text-wine hover:underline break-all block mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {lead.contact_email}
              </a>
            )}
            {lead.artwork && (
              <Link
                href={`/artworks/${lead.artwork.id}/certificate`}
                className="flex items-center gap-1.5 mt-1 text-xs text-ink/70 hover:text-wine min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                {lead.artwork.image_url ? (
                  <span className="relative w-6 h-6 rounded overflow-hidden flex-shrink-0 bg-parchment">
                    <Image
                      src={lead.artwork.image_url}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                ) : null}
                <span className="line-clamp-2 break-words min-w-0">{lead.artwork.title}</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 pt-0.5 border-t border-wine/10">
            {otherStages.length > 0 && (
              <div className="flex-1 min-w-0">
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (LEAD_STAGES.includes(value as LeadStage)) onMove(value as LeadStage);
                  }}
                >
                  <SelectTrigger
                    className="h-7 text-xs w-full min-w-0 max-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SelectValue placeholder="Move to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherStages.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 ml-auto text-ink/50 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete lead"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableLeadCard({
  lead,
  onMove,
  onDelete,
  onOpenEdit,
}: {
  lead: ArtistLead;
  onMove: (stage: LeadStage) => void;
  onDelete: () => void;
  onOpenEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div ref={setNodeRef} className="touch-none">
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 text-ink/40 hover:text-wine mt-1 rounded"
          aria-label="Drag to move"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <LeadCard
            lead={lead}
            onMove={onMove}
            onDelete={onDelete}
            isDragging={isDragging}
            onOpenEdit={onOpenEdit}
          />
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  stage,
  leads,
  onMove,
  onDelete,
  onOpenEdit,
}: {
  stage: LeadStage;
  leads: ArtistLead[];
  onMove: (leadId: string, stage: LeadStage) => void;
  onDelete: (leadId: string) => void;
  onOpenEdit: (lead: ArtistLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex flex-col min-w-[240px] w-[240px] flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-semibold text-wine text-sm uppercase tracking-wide">
          {STAGE_LABELS[stage]}
        </h3>
        <span className="text-xs text-ink/60 bg-wine/10 text-wine px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 rounded-lg border p-2 min-h-[120px] transition-colors ${
          isOver ? 'bg-wine/15 border-wine/40' : 'bg-parchment/40 border-wine/10'
        }`}
      >
        {leads.map((lead) => (
          <SortableLeadCard
            key={lead.id}
            lead={lead}
            onMove={(newStage) => onMove(lead.id, newStage)}
            onDelete={() => onDelete(lead.id)}
            onOpenEdit={() => onOpenEdit(lead)}
          />
        ))}
      </div>
    </div>
  );
}

export function LeadsKanban({
  initialLeads,
  artistArtworks,
}: {
  initialLeads: ArtistLead[];
  artistArtworks: { id: string; title: string; image_url: string | null }[];
}) {
  const [leads, setLeads] = useState<ArtistLead[]>(initialLeads);
  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<ArtistLead | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formContactName, setFormContactName] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formArtworkId, setFormArtworkId] = useState<string>('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editArtworkId, setEditArtworkId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const leadsByStage = LEAD_STAGES.reduce(
    (acc, stage) => ({
      ...acc,
      [stage]: leads.filter((l) => l.stage === stage),
    }),
    {} as Record<LeadStage, ArtistLead[]>
  );

  const handleMove = (leadId: string, newStage: LeadStage) => {
    startTransition(async () => {
      const result = await updateLeadStage(leadId, newStage);
      if (result.success) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
        );
        toast.success(`Moved to ${STAGE_LABELS[newStage]}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = (leadId: string) => {
    if (!confirm('Remove this lead from the board?')) return;
    startTransition(async () => {
      const result = await deleteLead(leadId);
      if (result.success) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        toast.success('Lead removed');
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const overId = over.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const newStage = LEAD_STAGES.includes(overId as LeadStage)
      ? (overId as LeadStage)
      : leads.find((l) => l.id === overId)?.stage;
    if (newStage && newStage !== lead.stage) {
      handleMove(leadId, newStage);
    }
  };

  const handleAddLead = () => {
    startTransition(async () => {
      const result = await createLead({
        contact_name: formContactName.trim() || null,
        contact_email: formContactEmail.trim() || null,
        contact_phone: formContactPhone.trim() || null,
        notes: formNotes.trim() || null,
        artwork_id: formArtworkId || null,
      });
      if (result.success) {
        const fresh = await getLeadsForArtist();
        setLeads(fresh);
        setAddOpen(false);
        setFormContactName('');
        setFormContactEmail('');
        setFormContactPhone('');
        setFormNotes('');
        setFormArtworkId('');
        toast.success('Lead added');
      } else {
        toast.error(result.error);
      }
    });
  };

  const openEditLead = (lead: ArtistLead) => {
    setEditLead(lead);
    setEditContactName(lead.contact_name ?? '');
    setEditContactEmail(lead.contact_email ?? '');
    setEditContactPhone(lead.contact_phone ?? '');
    setEditNotes(lead.notes ?? '');
    setEditArtworkId(lead.artwork_id ?? '');
  };

  const handleEditLeadSave = () => {
    if (!editLead) return;
    console.log('[Leads] handleEditLeadSave started', editLead.id);
    startTransition(async () => {
      const result = await updateLead(editLead.id, {
        contact_name: editContactName.trim() || null,
        contact_email: editContactEmail.trim() || null,
        contact_phone: editContactPhone.trim() || null,
        notes: editNotes.trim() || null,
        artwork_id: editArtworkId || null,
      });
      if (result.success) {
        console.log('[Leads] handleEditLeadSave success');
        const fresh = await getLeadsForArtist();
        setLeads(fresh);
        setEditLead(null);
        toast.success('Lead updated');
      } else {
        console.error('[Leads] handleEditLeadSave failed', result.error);
        toast.error(result.error);
      }
    });
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-ink/70 font-serif text-sm">
          Drag cards between columns or use &quot;Move to&quot;.
        </p>
        <Button
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          onClick={() => setAddOpen(true)}
          disabled={pending}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add lead
        </Button>
      </div>

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
              onDelete={handleDelete}
              onOpenEdit={openEditLead}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="w-[240px]">
              <LeadCard
                lead={activeLead}
                onMove={(s) => handleMove(activeLead.id, s)}
                onDelete={() => handleDelete(activeLead.id)}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">
              Add lead
            </DialogTitle>
            <DialogDescription>
              Someone interested in buying your artwork? Add their details here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lead-name">Name</Label>
              <Input
                id="lead-name"
                placeholder="e.g. Jane Collector"
                value={formContactName}
                onChange={(e) => setFormContactName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                placeholder="jane@example.com"
                value={formContactEmail}
                onChange={(e) => setFormContactEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                type="tel"
                placeholder="Optional"
                value={formContactPhone}
                onChange={(e) => setFormContactPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-artwork">Interested in artwork (optional)</Label>
              <Select value={formArtworkId || 'none'} onValueChange={(v) => setFormArtworkId(v === 'none' ? '' : v)}>
                <SelectTrigger id="lead-artwork">
                  <SelectValue placeholder="Select artwork" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / General inquiry</SelectItem>
                  {artistArtworks.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                placeholder="e.g. Met at fair, interested in large works"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-wine text-parchment hover:bg-wine/90"
              onClick={handleAddLead}
              disabled={pending || (!formContactName.trim() && !formContactEmail.trim())}
            >
              {pending ? 'Adding…' : 'Add lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editLead !== null}
        onOpenChange={(open) => {
          if (!open) setEditLead(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Edit lead</DialogTitle>
            <DialogDescription>
              Update contact details, linked artwork, or notes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-lead-name">Name</Label>
              <Input
                id="edit-lead-name"
                placeholder="e.g. Jane Collector"
                value={editContactName}
                onChange={(e) => setEditContactName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lead-email">Email</Label>
              <Input
                id="edit-lead-email"
                type="email"
                placeholder="jane@example.com"
                value={editContactEmail}
                onChange={(e) => setEditContactEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lead-phone">Phone</Label>
              <Input
                id="edit-lead-phone"
                type="tel"
                placeholder="Optional"
                value={editContactPhone}
                onChange={(e) => setEditContactPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lead-artwork">Interested in artwork (optional)</Label>
              <Select
                value={editArtworkId || 'none'}
                onValueChange={(v) => setEditArtworkId(v === 'none' ? '' : v)}
              >
                <SelectTrigger id="edit-lead-artwork">
                  <SelectValue placeholder="Select artwork" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / General inquiry</SelectItem>
                  {artistArtworks.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lead-notes">Notes</Label>
              <Textarea
                id="edit-lead-notes"
                placeholder="e.g. Met at fair, interested in large works"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLead(null)}>
              Cancel
            </Button>
            <Button
              className="bg-wine text-parchment hover:bg-wine/90"
              onClick={handleEditLeadSave}
              disabled={
                pending ||
                (!editContactName.trim() && !editContactEmail.trim())
              }
            >
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
