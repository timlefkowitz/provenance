'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Plus } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  EditorialSectionHeader,
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
} from '~/components/editorial-form';
import { MarkdownTextarea } from '~/components/markdown-textarea';
import {
  requestShowChange,
  updateMyParticipation,
  updateMyShowDetails,
  withdrawShowChangeRequest,
  type ArtistWorkspace,
} from '../../_actions/exhibition-artist-workspace';
import {
  canArtistEditField,
  SHOW_FIELD_LABELS,
  type ShowField,
} from '../../_helpers/show-collaboration';

/** Fields the artist sees here; the cover image is managed from the gallery's edit page. */
const EDITABLE_FIELDS: ShowField[] = ['title', 'description', 'start_date', 'end_date', 'location'];

function displayValue(field: ShowField, value: string | null | undefined): string {
  if (!value?.trim()) return '';
  if (field === 'start_date' || field === 'end_date') {
    const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }
  }
  return value;
}

export function ArtistWorkspaceClient({ workspace }: { workspace: ArtistWorkspace }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<ShowField, string>>(() => {
    const out = {} as Record<ShowField, string>;
    for (const f of EDITABLE_FIELDS) out[f] = (workspace.values[f] ?? '').slice(0, f.endsWith('_date') ? 10 : undefined);
    return out;
  });
  const [pieces, setPieces] = useState(
    workspace.plannedPieceCount === null ? '' : String(workspace.plannedPieceCount),
  );
  const [notes, setNotes] = useState(workspace.notes ?? '');
  const [requestField, setRequestField] = useState<ShowField | null>(null);
  const [proposal, setProposal] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  const editable = (field: ShowField) =>
    canArtistEditField({ canEditShow: workspace.canEditShow, fieldSources: workspace.fieldSources, field });
  const anyEditable = EDITABLE_FIELDS.some(editable);
  const pendingFields = new Set(
    workspace.requests.filter((r) => r.status === 'pending').map((r) => r.field),
  );
  const addWorksHref = `/exhibitions/submit?invite=${encodeURIComponent(workspace.inviteId)}`;
  const atLimit = workspace.maxArtworks !== null && workspace.works.length >= workspace.maxArtworks;

  const saveDetails = () => {
    const patch: Partial<Record<ShowField, string>> = {};
    for (const f of EDITABLE_FIELDS) if (editable(f)) patch[f] = values[f];
    startTransition(async () => {
      const result = await updateMyShowDetails(workspace.exhibitionId, patch);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.changed.length ? 'Show details saved' : 'Nothing changed');
      router.refresh();
    });
  };

  const saveParticipation = () => {
    startTransition(async () => {
      const result = await updateMyParticipation(workspace.exhibitionId, {
        plannedPieceCount: pieces,
        notes,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Saved');
      router.refresh();
    });
  };

  const openRequest = (field: ShowField) => {
    setRequestField(field);
    setProposal((workspace.values[field] ?? '').slice(0, field.endsWith('_date') ? 10 : undefined));
    setRequestMessage('');
  };

  const sendRequest = () => {
    if (!requestField) return;
    startTransition(async () => {
      const result = await requestShowChange(workspace.exhibitionId, {
        field: requestField,
        proposedValue: proposal,
        message: requestMessage,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Request sent to the gallery');
      setRequestField(null);
      router.refresh();
    });
  };

  const withdraw = (requestId: string) => {
    startTransition(async () => {
      const result = await withdrawShowChangeRequest(workspace.exhibitionId, requestId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Request withdrawn');
      router.refresh();
    });
  };

  return (
    <div className="space-y-14">
      {/* Show details */}
      <section>
        <EditorialSectionHeader
          eyebrow="The show"
          title="Show details"
          description={
            workspace.canEditShow
              ? 'Fill in anything still open. Fields the gallery set are locked; ask them for a change.'
              : 'The gallery manages these details. Ask them for a change if something needs fixing.'
          }
        />
        <div className="space-y-6">
          {EDITABLE_FIELDS.map((field) => {
            const canEdit = editable(field);
            const label = SHOW_FIELD_LABELS[field];
            const isDate = field === 'start_date' || field === 'end_date';
            return (
              <div key={field} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={`show-${field}`} className={FIELD_LABEL}>
                    {label}
                    {!canEdit && <Lock className="ml-1.5 inline h-3 w-3 text-editorial-ink/40" aria-label="Set by the gallery" />}
                  </Label>
                  {!canEdit && (
                    pendingFields.has(field) ? (
                      <span className="font-serif text-xs text-amber-800">Change requested</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openRequest(field)}
                        className="font-serif text-xs text-vermillion underline underline-offset-2"
                      >
                        Request a change
                      </button>
                    )
                  )}
                </div>
                {canEdit ? (
                  field === 'description' ? (
                    <MarkdownTextarea
                      id={`show-${field}`}
                      value={values[field]}
                      onChange={(v) => setValues((prev) => ({ ...prev, [field]: v }))}
                      placeholder="What is the show about?"
                      rows={6}
                    />
                  ) : (
                    <Input
                      id={`show-${field}`}
                      type={isDate ? 'date' : 'text'}
                      value={values[field]}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                      className={FIELD_INPUT}
                    />
                  )
                ) : (
                  <p className="font-serif text-sm text-editorial-ink whitespace-pre-line border-b border-editorial-border/20 pb-2">
                    {displayValue(field, workspace.values[field]) || (
                      <span className="italic text-editorial-ink/40">Not set</span>
                    )}
                  </p>
                )}

                {requestField === field && (
                  <div className="mt-2 space-y-3 border border-editorial-border/25 bg-cream/40 p-4">
                    <p className="font-serif text-sm text-editorial-ink">
                      What should the {label.toLowerCase()} be?
                    </p>
                    {field === 'description' ? (
                      <Textarea
                        value={proposal}
                        onChange={(e) => setProposal(e.target.value)}
                        rows={6}
                        className="font-serif text-sm"
                      />
                    ) : (
                      <Input
                        type={isDate ? 'date' : 'text'}
                        value={proposal}
                        onChange={(e) => setProposal(e.target.value)}
                        className={FIELD_INPUT}
                      />
                    )}
                    <Textarea
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder="Why? (optional, sent to the gallery)"
                      rows={2}
                      maxLength={2000}
                      className="font-serif text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={sendRequest}
                        className={cn(BUTTON_PRIMARY, 'hover:bg-vermillion')}
                      >
                        Send request
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setRequestField(null)}
                        className={BUTTON_SECONDARY}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {anyEditable && (
          <Button
            type="button"
            disabled={pending}
            onClick={saveDetails}
            className={cn(BUTTON_PRIMARY, 'mt-6 hover:bg-vermillion')}
          >
            Save show details
          </Button>
        )}
      </section>

      {/* Participation */}
      <section>
        <EditorialSectionHeader
          eyebrow="Your part"
          title="What you're bringing"
          description="Tell the gallery how many pieces you plan to show and anything else they should know: installation, shipping, pricing, availability."
        />
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="planned-pieces" className={FIELD_LABEL}>
              Number of pieces
            </Label>
            <Input
              id="planned-pieces"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              className={cn(FIELD_INPUT, 'w-32')}
            />
            {workspace.maxArtworks !== null && (
              <p className={FIELD_HINT}>The gallery set a limit of {workspace.maxArtworks} works.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="artist-notes" className={FIELD_LABEL}>
              Notes for the gallery
            </Label>
            <Textarea
              id="artist-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={4000}
              className="font-serif text-sm"
            />
          </div>
          <Button
            type="button"
            disabled={pending}
            onClick={saveParticipation}
            className={cn(BUTTON_PRIMARY, 'hover:bg-vermillion')}
          >
            Save
          </Button>
        </div>
      </section>

      {/* Works */}
      <section>
        <EditorialSectionHeader
          eyebrow="Works"
          title="Your works in the show"
          description="Works you add go straight into the show with a Certificate of Authenticity."
        />
        {workspace.works.length > 0 ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {workspace.works.map((w) => (
              <li key={w.id}>
                <Link href={`/artworks/${w.id}/certificate`} className="block group">
                  <div className="aspect-square bg-ink/5 overflow-hidden">
                    {w.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="mt-1 font-serif text-sm text-editorial-ink truncate group-hover:text-vermillion">
                    {w.title}
                  </p>
                  {w.status === 'submitted' && (
                    <p className="font-serif text-xs text-amber-800">Awaiting the gallery</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-serif text-sm text-editorial-ink/55 mb-6">No works added yet.</p>
        )}
        {!atLimit && (
          <Button asChild className={cn(BUTTON_PRIMARY, 'hover:bg-vermillion')}>
            <Link href={addWorksHref}>
              <Plus className="h-4 w-4 mr-1" /> Add works
            </Link>
          </Button>
        )}
        {atLimit && (
          <p className={FIELD_HINT}>You&apos;ve added as many works as the gallery allowed.</p>
        )}
      </section>

      {/* Requests */}
      {workspace.requests.length > 0 && (
        <section>
          <EditorialSectionHeader eyebrow="Requests" title="Changes you've asked for" />
          <ul className="space-y-3">
            {workspace.requests.map((r) => (
              <li key={r.id} className="border border-editorial-border/20 bg-cream/40 p-4 font-serif text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-editorial-ink">
                    {r.fieldLabel}:{' '}
                    <span className="text-editorial-ink/70">
                      {displayValue(r.field, r.proposedValue) || 'blank'}
                    </span>
                  </p>
                  <span
                    className={cn(
                      'text-[11px] uppercase tracking-wide px-2 py-0.5 border',
                      r.status === 'pending' && 'bg-amber-50 text-amber-900 border-amber-200',
                      r.status === 'approved' && 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      (r.status === 'declined' || r.status === 'withdrawn') &&
                        'bg-cream/50 text-editorial-ink/50 border-ink/15',
                    )}
                  >
                    {r.status === 'pending' ? 'Waiting' : r.status}
                  </span>
                </div>
                {r.responseMessage && (
                  <p className="mt-2 text-xs text-editorial-ink/70">Gallery: “{r.responseMessage}”</p>
                )}
                {r.status === 'pending' && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => withdraw(r.id)}
                    className="mt-2 text-xs text-editorial-ink/55 underline underline-offset-2"
                  >
                    Withdraw
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
