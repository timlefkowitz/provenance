'use client';

import { useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Clock, Edit, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { toast } from '@kit/ui/sonner';

import type { Artwork } from '~/app/artworks/[id]/certificate/_components/certificate-of-authenticity';
import { RequestUpdateDialog } from '~/app/artworks/[id]/certificate/_components/request-update-dialog';
import { issueMissingCertificatesOfShow } from '~/app/exhibitions/_actions/manage-exhibition-artworks';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';

import { SellWorkDialog } from './sell-work-dialog';

export type CuratorWork = {
  artwork: Artwork;
  certificateType: string | null;
  isDraft: boolean;
  /** Name of the account holding the certificate. */
  holderName: string | null;
  /** The curator (or their gallery team) holds this certificate. */
  editable: boolean;
  /** Where to edit it directly; null when the change goes to someone else first. */
  editHref: string | null;
  /** Set for a Certificate of Show whose changes the artist approves. */
  approverName: string | null;
  /** This curator already has a change awaiting the holder or artist. */
  changePending: boolean;
  /** An artist's COA in the show that hasn't had its Certificate of Show issued yet. */
  awaitsCos: boolean;
  /** Marked sold; the buyer's name or email when recorded. */
  sold: { to: string | null } | null;
};

const TYPE_LABEL: Record<string, string> = {
  [CERTIFICATE_TYPES.SHOW]: 'Certificate of Show',
  [CERTIFICATE_TYPES.AUTHENTICITY]: 'Certificate of Authenticity',
  [CERTIFICATE_TYPES.OWNERSHIP]: 'Certificate of Ownership',
};

export type CuratorSelection = {
  selectedIds: Set<string>;
  onToggle: (artworkId: string) => void;
};

export function CuratorWorksList({
  works,
  exhibitionId,
  awaitingCosCount,
  selection,
}: {
  works: CuratorWork[];
  exhibitionId: string;
  awaitingCosCount: number;
  /** When set, each work gets a checkbox (e.g. to choose what to print). */
  selection?: CuratorSelection;
}) {
  const router = useRouter();
  const [issuing, startIssuing] = useTransition();
  const editable = works.filter((w) => w.editable);
  const heldByOthers = works.filter((w) => !w.editable);

  const issueMissing = () =>
    startIssuing(async () => {
      const result = await issueMissingCertificatesOfShow(exhibitionId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.failed > 0) {
        toast.error(
          `Issued ${result.issued}; ${result.failed} could not be issued. Try again.`,
        );
      } else {
        toast.success(
          `Issued ${result.issued} Certificate${result.issued === 1 ? '' : 's'} of Show. The artists were notified.`,
        );
      }
      router.refresh();
    });

  if (works.length === 0) {
    return (
      <div className="border-wine/15 text-ink/40 rounded-2xl border border-dashed py-24 text-center font-serif text-sm">
        No works in this show yet.
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {awaitingCosCount > 0 && (
        <div className="border-wine/20 bg-wine/5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink/70 font-serif text-sm">
            {awaitingCosCount} selected work
            {awaitingCosCount === 1 ? ' has' : 's have'} no Certificate of Show
            yet. Issue {awaitingCosCount === 1 ? 'it' : 'them'} to edit{' '}
            {awaitingCosCount === 1 ? 'it' : 'them'} here, with the
            artist&apos;s approval.
          </p>
          <Button
            size="sm"
            onClick={issueMissing}
            disabled={issuing}
            className="bg-wine text-parchment hover:bg-wine/90 shrink-0 gap-1.5 font-serif"
          >
            {issuing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Issue Certificate{awaitingCosCount === 1 ? '' : 's'} of Show
          </Button>
        </div>
      )}
      <Section
        title="Your certificates"
        note="Certificates of Show for this show. Changes to one issued from an artist's certificate go to the artist to approve."
        works={editable}
        selection={selection}
        renderAction={(w) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!w.sold && (
              <SellWorkDialog
                exhibitionId={exhibitionId}
                artworkId={w.artwork.id}
                artworkTitle={w.artwork.title}
              />
            )}
            {w.approverName ? (
              w.changePending ? (
                <span className="inline-flex items-center gap-1.5 font-serif text-xs text-amber-800">
                  <Clock className="h-3.5 w-3.5" />
                  Awaiting {w.approverName}&apos;s approval
                </span>
              ) : (
                <RequestUpdateDialog
                  artwork={w.artwork}
                  exhibitionId={exhibitionId}
                  triggerLabel="Edit"
                  approverName={w.approverName}
                  onSubmitted={() => router.refresh()}
                />
              )
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-wine/30 hover:bg-wine/10 h-8 gap-1.5 font-serif"
              >
                <Link href={w.editHref!}>
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Link>
              </Button>
            )}
          </div>
        )}
      />
      <Section
        title="Artists' certificates"
        note="Held by the artist. Suggested changes go to them to accept or decline."
        works={heldByOthers}
        selection={selection}
        renderAction={(w) =>
          w.changePending ? (
            <span className="inline-flex items-center gap-1.5 font-serif text-xs text-amber-800">
              <Clock className="h-3.5 w-3.5" />
              Awaiting {w.holderName || 'holder'}
            </span>
          ) : (
            <RequestUpdateDialog
              artwork={w.artwork}
              exhibitionId={exhibitionId}
              triggerLabel="Suggest changes"
              onSubmitted={() => router.refresh()}
            />
          )
        }
      />
    </div>
  );
}

function Section({
  title,
  note,
  works,
  selection,
  renderAction,
}: {
  title: string;
  note: string;
  works: CuratorWork[];
  selection?: CuratorSelection;
  renderAction: (work: CuratorWork) => React.ReactNode;
}) {
  if (works.length === 0) return null;
  return (
    <section>
      <div className="border-wine/10 mb-6 border-b pb-3">
        <h2 className="font-display text-ink text-2xl font-bold">
          {title}{' '}
          <span className="text-ink/40 font-serif text-base font-normal">
            {works.length}
          </span>
        </h2>
        <p className="text-ink/50 mt-1 font-serif text-xs">{note}</p>
      </div>
      <ol className="divide-wine/10 divide-y">
        {works.map((w) => (
          <li key={w.artwork.id} className="flex items-center gap-4 py-4">
            {selection && (
              <Checkbox
                checked={selection.selectedIds.has(w.artwork.id)}
                onCheckedChange={() => selection.onToggle(w.artwork.id)}
                aria-label={`Select ${w.artwork.title}`}
                className="border-wine/40 data-[state=checked]:bg-wine data-[state=checked]:border-wine shrink-0"
              />
            )}
            <Link
              href={`/artworks/${w.artwork.id}/certificate`}
              className="bg-ink/5 relative h-16 w-16 shrink-0 overflow-hidden rounded"
            >
              {w.artwork.image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- remote thumbnails, same as artwork cards
                <img
                  src={w.artwork.image_url}
                  alt={w.artwork.title}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/artworks/${w.artwork.id}/certificate`}
                className="font-display text-ink hover:text-wine block truncate text-lg font-semibold"
              >
                {w.artwork.title}
              </Link>
              <p className="text-ink/55 truncate font-serif text-sm">
                {w.artwork.artist_name || 'Unknown artist'}
              </p>
              <div className="text-ink/45 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-serif text-[11px]">
                <span>
                  {TYPE_LABEL[w.certificateType ?? ''] ?? 'Certificate'}
                </span>
                {!w.editable && w.holderName && (
                  <span>Held by {w.holderName}</span>
                )}
                {w.approverName && (
                  <span>Edits approved by {w.approverName}</span>
                )}
                {w.awaitsCos && (
                  <span className="text-wine/70">
                    Certificate of Show not issued
                  </span>
                )}
                {w.sold && (
                  <span className="border-wine/25 bg-wine/5 text-wine rounded-full border px-2 py-0.5 tracking-widest uppercase">
                    Sold{w.sold.to ? ` · ${w.sold.to}` : ''}
                  </span>
                )}
                {w.isDraft && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 tracking-widest text-amber-900 uppercase">
                    Draft
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0">{renderAction(w)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
