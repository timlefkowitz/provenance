'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Edit } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { RequestUpdateDialog } from '~/app/artworks/[id]/certificate/_components/request-update-dialog';
import type { Artwork } from '~/app/artworks/[id]/certificate/_components/certificate-of-authenticity';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';

export type CuratorWork = {
  artwork: Artwork;
  certificateType: string | null;
  isDraft: boolean;
  /** Name of the account holding the certificate. */
  holderName: string | null;
  /** Where to edit it directly; null when the change must go to the holder. */
  editHref: string | null;
  /** This curator already has a suggestion awaiting the holder. */
  changePending: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  [CERTIFICATE_TYPES.SHOW]: 'Certificate of Show',
  [CERTIFICATE_TYPES.AUTHENTICITY]: 'Certificate of Authenticity',
  [CERTIFICATE_TYPES.OWNERSHIP]: 'Certificate of Ownership',
};

export function CuratorWorksList({
  works,
  exhibitionId,
}: {
  works: CuratorWork[];
  exhibitionId: string;
}) {
  const router = useRouter();
  const editable = works.filter((w) => w.editHref);
  const heldByOthers = works.filter((w) => !w.editHref);

  if (works.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-wine/15 py-24 text-center font-serif text-sm text-ink/40">
        No works in this show yet.
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <Section
        title="Your certificates"
        note="Certificates of Show issued by the gallery. Edit them directly."
        works={editable}
        renderAction={(w) => (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-wine/30 font-serif hover:bg-wine/10"
          >
            <Link href={w.editHref!}>
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        )}
      />
      <Section
        title="Artists' certificates"
        note="Held by the artist. Suggested changes go to them to accept or decline."
        works={heldByOthers}
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
  renderAction,
}: {
  title: string;
  note: string;
  works: CuratorWork[];
  renderAction: (work: CuratorWork) => React.ReactNode;
}) {
  if (works.length === 0) return null;
  return (
    <section>
      <div className="mb-6 border-b border-wine/10 pb-3">
        <h2 className="font-display text-2xl font-bold text-ink">
          {title}{' '}
          <span className="font-serif text-base font-normal text-ink/40">{works.length}</span>
        </h2>
        <p className="mt-1 font-serif text-xs text-ink/50">{note}</p>
      </div>
      <ol className="divide-y divide-wine/10">
        {works.map((w) => (
          <li key={w.artwork.id} className="flex items-center gap-4 py-4">
            <Link
              href={`/artworks/${w.artwork.id}/certificate`}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-ink/5"
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
                className="block truncate font-display text-lg font-semibold text-ink hover:text-wine"
              >
                {w.artwork.title}
              </Link>
              <p className="truncate font-serif text-sm text-ink/55">
                {w.artwork.artist_name || 'Unknown artist'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-serif text-[11px] text-ink/45">
                <span>{TYPE_LABEL[w.certificateType ?? ''] ?? 'Certificate'}</span>
                {!w.editHref && w.holderName && <span>Held by {w.holderName}</span>}
                {w.isDraft && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 uppercase tracking-widest text-amber-900">
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
