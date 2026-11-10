'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
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
import { toast } from '@kit/ui/sonner';

import {
  CV_ENTRY_TYPES,
  CV_ENTRY_TYPE_LABELS,
  type ArtistCvEntry,
  type ArtistDetailFields,
  type CvEntryType,
} from '~/lib/artist-details/fields';
import type { NewsPublicationInput } from '~/lib/news-publications';
import {
  saveExhibitionArtistDetails,
  uploadExhibitionArtistPhoto,
  type CuratorExhibitionArtist,
} from '~/app/exhibitions/_actions/exhibition-artist-details';

type Draft = {
  bio: string;
  artist_statement: string;
  picture_url: string;
  birth_year: string;
  birth_place: string;
  nationality: string;
  death_year: string;
  website: string;
  cv_entries: ArtistCvEntry[];
  press: NewsPublicationInput[];
};

function toDraft(f: ArtistDetailFields): Draft {
  return {
    bio: f.bio ?? '',
    artist_statement: f.artist_statement ?? '',
    picture_url: f.picture_url ?? '',
    birth_year: f.birth_year ? String(f.birth_year) : '',
    birth_place: f.birth_place ?? '',
    nationality: f.nationality ?? '',
    death_year: f.death_year ? String(f.death_year) : '',
    website: f.website ?? '',
    cv_entries: f.cv_entries,
    press: f.press,
  };
}

type TextKey = Exclude<keyof Draft, 'cv_entries' | 'press'>;

/**
 * Edit the curator's copy of one artist for this show: photo, bio,
 * statement, label details, website, CV and press. Starts from the show copy
 * where saved, else the artist's profile. Saving never changes the profile.
 */
export function EditExhibitionArtistDialog({
  open,
  onOpenChange,
  exhibitionId,
  artist,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitionId: string;
  artist: CuratorExhibitionArtist;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(artist.effective));
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = toDraft(artist.profileFields);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const resetLink = (key: TextKey) =>
    draft[key] !== profile[key] ? (
      <button
        type="button"
        className="font-serif text-[11px] text-ink/40 underline hover:text-ink"
        onClick={() => set(key, profile[key])}
      >
        {profile[key] ? 'Reset to profile' : 'Clear'}
      </button>
    ) : null;

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set('exhibitionId', exhibitionId);
    fd.set('file', file);
    const res = await uploadExhibitionArtistPhoto(fd);
    setUploading(false);
    if (res.error || !res.url) {
      toast.error(res.error || 'Upload failed');
      return;
    }
    set('picture_url', res.url);
  };

  const save = () => {
    startTransition(async () => {
      // Fields equal to the profile are stored as null so they keep
      // following the profile if the artist updates it later.
      const keep = (key: TextKey) => (draft[key].trim() && draft[key] !== profile[key] ? draft[key] : null);
      const sameList = (a: unknown[], b: unknown[]) => JSON.stringify(a) === JSON.stringify(b);
      const res = await saveExhibitionArtistDetails({
        exhibitionId,
        artistKey: artist.key,
        fields: {
          bio: keep('bio'),
          artist_statement: keep('artist_statement'),
          picture_url: keep('picture_url'),
          birth_year: keep('birth_year'),
          birth_place: keep('birth_place'),
          nationality: keep('nationality'),
          death_year: keep('death_year'),
          website: keep('website'),
          cv_entries: sameList(draft.cv_entries, profile.cv_entries) ? [] : draft.cv_entries,
          press: sameList(draft.press, profile.press) ? [] : draft.press,
        },
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success('Saved for this show');
      onOpenChange(false);
      router.refresh();
    });
  };

  const updateCv = (i: number, patch: Partial<ArtistCvEntry>) =>
    set(
      'cv_entries',
      draft.cv_entries.map((e, j) => (j === i ? { ...e, ...patch } : e)),
    );
  const updatePress = (i: number, patch: Partial<NewsPublicationInput>) =>
    set(
      'press',
      draft.press.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{artist.name}</DialogTitle>
          <DialogDescription className="font-serif">
            For this show&apos;s labels, catalog and Artists tab. The artist&apos;s profile doesn&apos;t
            change until you send these to them and they accept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Photo */}
          <section className="flex items-center gap-4">
            {draft.picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.picture_url} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-wine/10 font-serif text-xs text-wine/60">
                No photo
              </span>
            )}
            <div className="space-y-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPhoto(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-serif"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {draft.picture_url ? 'Replace photo' : 'Upload photo'}
              </Button>
              <div>{resetLink('picture_url')}</div>
            </div>
          </section>

          {/* Bio */}
          <section className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ea-bio" className="font-serif">Bio</Label>
              {resetLink('bio')}
            </div>
            <Textarea
              id="ea-bio"
              rows={5}
              value={draft.bio}
              onChange={(e) => set('bio', e.target.value)}
              className="font-serif text-sm"
              placeholder="A short third-person bio for labels and the catalog"
            />
          </section>

          {/* Statement */}
          <section className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ea-statement" className="font-serif">Artist statement</Label>
              {resetLink('artist_statement')}
            </div>
            <Textarea
              id="ea-statement"
              rows={5}
              value={draft.artist_statement}
              onChange={(e) => set('artist_statement', e.target.value)}
              className="font-serif text-sm"
              placeholder="The artist's statement, in their words"
            />
          </section>

          {/* Details */}
          <section className="space-y-2">
            <p className="font-serif text-[10px] uppercase tracking-widest text-ink/40">Label details</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['birth_year', 'Born (year)', '1984'],
                  ['birth_place', 'Birthplace', 'Lagos, Nigeria'],
                  ['nationality', 'Nationality', 'Nigerian'],
                  ['death_year', 'Died (year)', ''],
                ] as [TextKey, string, string][]
              ).map(([key, label, ph]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`ea-${key}`} className="font-serif text-xs">{label}</Label>
                  <Input
                    id={`ea-${key}`}
                    value={draft[key]}
                    inputMode={key.endsWith('year') ? 'numeric' : undefined}
                    onChange={(e) =>
                      set(key, key.endsWith('year') ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)
                    }
                    placeholder={ph}
                    className="font-serif text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="ea-website" className="font-serif text-xs">Website</Label>
                {resetLink('website')}
              </div>
              <Input
                id="ea-website"
                value={draft.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://"
                className="font-serif text-sm"
              />
            </div>
          </section>

          {/* CV */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="font-serif text-[10px] uppercase tracking-widest text-ink/40">CV</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 font-serif text-xs"
                onClick={() => set('cv_entries', [...draft.cv_entries, { type: 'exhibition', title: '' }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add entry
              </Button>
            </div>
            {draft.cv_entries.length === 0 && (
              <p className="font-serif text-xs text-ink/40">No CV entries yet. Find information can fill these in.</p>
            )}
            {draft.cv_entries.map((e, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <select
                  aria-label="Type"
                  value={e.type}
                  onChange={(ev) => updateCv(i, { type: ev.target.value as CvEntryType })}
                  className="col-span-3 rounded-md border border-input bg-transparent px-2 font-serif text-xs"
                >
                  {CV_ENTRY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CV_ENTRY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="Title"
                  value={e.title}
                  onChange={(ev) => updateCv(i, { title: ev.target.value })}
                  placeholder="Title"
                  className="col-span-4 font-serif text-xs"
                />
                <Input
                  aria-label="Venue"
                  value={e.venue ?? ''}
                  onChange={(ev) => updateCv(i, { venue: ev.target.value })}
                  placeholder="Venue / school"
                  className="col-span-3 font-serif text-xs"
                />
                <Input
                  aria-label="Year"
                  value={e.year ?? ''}
                  onChange={(ev) => updateCv(i, { year: ev.target.value })}
                  placeholder="Year"
                  className="col-span-1 px-1 font-serif text-xs"
                />
                <button
                  type="button"
                  aria-label="Remove entry"
                  className="col-span-1 flex items-center justify-center text-ink/40 hover:text-red-700"
                  onClick={() => set('cv_entries', draft.cv_entries.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </section>

          {/* Press */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="font-serif text-[10px] uppercase tracking-widest text-ink/40">Press</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 font-serif text-xs"
                onClick={() => set('press', [...draft.press, { title: '', url: '' }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add article
              </Button>
            </div>
            {draft.press.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <Input
                  aria-label="Headline"
                  value={p.title}
                  onChange={(ev) => updatePress(i, { title: ev.target.value })}
                  placeholder="Headline"
                  className="col-span-5 font-serif text-xs"
                />
                <Input
                  aria-label="Publication"
                  value={p.publication_name ?? ''}
                  onChange={(ev) => updatePress(i, { publication_name: ev.target.value })}
                  placeholder="Publication"
                  className="col-span-3 font-serif text-xs"
                />
                <Input
                  aria-label="URL"
                  value={p.url}
                  onChange={(ev) => updatePress(i, { url: ev.target.value })}
                  placeholder="https://"
                  className="col-span-3 font-serif text-xs"
                />
                <button
                  type="button"
                  aria-label="Remove article"
                  className="col-span-1 flex items-center justify-center text-ink/40 hover:text-red-700"
                  onClick={() => set('press', draft.press.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="font-serif" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="font-serif" onClick={save} disabled={pending || uploading}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save for this show
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
