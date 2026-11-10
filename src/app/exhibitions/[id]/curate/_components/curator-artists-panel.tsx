'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Search, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import type { CuratorExhibitionArtist } from '~/app/exhibitions/_actions/exhibition-artist-details';
import { sendArtistProfileSuggestion } from '~/app/exhibitions/_actions/send-artist-profile-suggestion';
import { EditExhibitionArtistDialog } from './edit-exhibition-artist-dialog';
import { ArtistResearchSheet } from './artist-research-sheet';

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

const LINK_BADGE: Record<CuratorExhibitionArtist['link'], { label: string; className: string }> = {
  claimed: { label: 'On Provenance', className: 'border-notify-success/40 text-notify-success' },
  placeholder: { label: 'Unclaimed profile', className: 'border-wine/25 text-wine/70' },
  placeholder_other: { label: 'Unclaimed profile', className: 'border-ink/20 text-ink/50' },
  name_only: { label: 'No profile', className: 'border-ink/20 text-ink/50' },
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-serif text-[10px] uppercase tracking-widest ${className}`}>
      {children}
    </span>
  );
}

/**
 * The curator's Artists tab: each artist's bio, statement, photo and label
 * details for this show, a web search for sourced facts, and a way to pass
 * the changes on to the artist's own profile.
 */
export function CuratorArtistsPanel({
  exhibitionId,
  artists,
  error,
}: {
  exhibitionId: string;
  artists: CuratorExhibitionArtist[];
  error?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CuratorExhibitionArtist | null>(null);
  const [researching, setResearching] = useState<CuratorExhibitionArtist | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const send = (artist: CuratorExhibitionArtist) => {
    setSendingKey(artist.key);
    startTransition(async () => {
      const res = await sendArtistProfileSuggestion({ exhibitionId, artistKey: artist.key });
      setSendingKey(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.mode === 'applied'
          ? `Updated ${artist.name}'s profile: ${res.fields.join(', ')}`
          : `Sent to ${artist.name} to review: ${res.fields.join(', ')}`,
      );
      router.refresh();
    });
  };

  if (error) return <p className="font-serif text-sm text-red-700">{error}</p>;
  if (artists.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-wine/15 py-16 text-center font-serif text-sm text-ink/40">
        No artists in this show yet. Add works and their artists appear here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl font-serif text-sm leading-relaxed text-ink/60">
        Edit each artist&apos;s bio, statement, photo and details for this show. Your edits are used on
        wall labels, the catalog and the public Artists tab. Use <em>Find information</em> to pull in
        sourced facts from the web, then send the changes to the artist to add to their profile.
      </p>
      <ul className="space-y-3">
        {artists.map((a) => {
          const badge = LINK_BADGE[a.link];
          const canSend = a.link === 'claimed' || a.link === 'placeholder';
          const hasShowCopy = a.show !== null;
          return (
            <li key={a.key} className="flex flex-col gap-4 rounded-xl border border-wine/12 bg-parchment/40 p-4 sm:flex-row">
              {a.effective.picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.effective.picture_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-wine/12 font-serif font-semibold text-wine">
                  {initials(a.name)}
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold text-ink">{a.name}</p>
                  <Badge className={badge.className}>{badge.label}</Badge>
                  {a.pendingSuggestion && <Badge className="border-wine/40 text-wine">Awaiting artist</Badge>}
                  {hasShowCopy && <Badge className="border-ink/20 text-ink/50">Edited for show</Badge>}
                  {a.suggestedFindings > 0 && (
                    <Badge className="border-wine/40 text-wine">{a.suggestedFindings} to review</Badge>
                  )}
                </div>
                <p className="font-serif text-xs text-ink/50">
                  {[a.tombstone, `${a.artworkCount} work${a.artworkCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                </p>
                {a.effective.bio ? (
                  <p className="line-clamp-3 font-serif text-sm text-ink/70">{a.effective.bio}</p>
                ) : (
                  <p className="font-serif text-sm italic text-ink/40">No bio yet.</p>
                )}
                <p className="font-serif text-[11px] text-ink/40">
                  {[
                    a.effective.artist_statement ? 'Statement' : null,
                    a.effective.cv_entries.length ? `${a.effective.cv_entries.length} CV entries` : null,
                    a.effective.press.length ? `${a.effective.press.length} press` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 flex-row flex-wrap gap-2 sm:flex-col">
                <Button variant="outline" size="sm" className="font-serif" onClick={() => setEditing(a)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit details
                </Button>
                <Button variant="outline" size="sm" className="font-serif" onClick={() => setResearching(a)}>
                  <Search className="mr-1.5 h-3.5 w-3.5" /> Find information
                </Button>
                {canSend && (
                  <Button
                    size="sm"
                    className="font-serif"
                    disabled={!hasShowCopy || sendingKey === a.key}
                    title={hasShowCopy ? undefined : 'Edit details or accept findings first'}
                    onClick={() => send(a)}
                  >
                    {sendingKey === a.key ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {a.link === 'placeholder' ? 'Update profile' : 'Send to artist'}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <EditExhibitionArtistDialog
          key={editing.key}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          exhibitionId={exhibitionId}
          artist={editing}
        />
      )}
      {researching && (
        <ArtistResearchSheet
          open
          onOpenChange={(o) => !o && setResearching(null)}
          exhibitionId={exhibitionId}
          artistKey={researching.key}
          artistName={researching.name}
        />
      )}
    </div>
  );
}
