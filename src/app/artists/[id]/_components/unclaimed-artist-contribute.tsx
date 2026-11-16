'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, PencilLine, Plus, X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import pathsConfig from '~/config/paths.config';
import {
  addUnclaimedArtistExhibitions,
  removeUnclaimedArtistHeaderImage,
  updateUnclaimedArtistText,
  uploadUnclaimedArtistHeaderImage,
} from '../_actions/contribute-to-unclaimed-artist';
import { CvUploadPanel } from './cv-upload-panel';

export type ContributableContent = {
  bio: string | null;
  artist_statement: string | null;
  header_image_url: string | null;
  hasCv: boolean;
  cvUploadedAt: string | null;
};

const sectionTitle = 'text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-3';

function TextField({
  profileId,
  field,
  label,
  initial,
  placeholder,
}: {
  profileId: string;
  field: 'bio' | 'artist_statement';
  label: string;
  initial: string | null;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? '');
  const [isPending, startTransition] = useTransition();
  const dirty = value.trim() !== (initial ?? '').trim();

  const save = () =>
    startTransition(async () => {
      const result = await updateUnclaimedArtistText({ profileId, field, value });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} saved`);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <Label htmlFor={`contrib-${field}`} className="font-serif">
        {label}
      </Label>
      <Textarea
        id={`contrib-${field}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={5}
        className="font-serif text-sm"
      />
      <Button
        size="sm"
        onClick={save}
        disabled={!dirty || isPending}
        className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs"
      >
        {isPending ? 'Saving…' : `Save ${label.toLowerCase()}`}
      </Button>
    </div>
  );
}

function HeaderImageField({ profileId, url }: { profileId: string; url: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const onFile = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image size must be less than 5MB');
    const fd = new FormData();
    fd.append('profileId', profileId);
    fd.append('file', file);
    startTransition(async () => {
      const result = await uploadUnclaimedArtistHeaderImage(fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Header image saved');
      router.refresh();
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await removeUnclaimedArtistHeaderImage(profileId);
      if (!result.success) toast.error(result.error);
      else router.refresh();
    });

  return (
    <div className="space-y-2">
      <Label className="font-serif">Header image</Label>
      <p className="text-xs text-ink/55 font-serif">A wide banner across the top of the page. Landscape works best.</p>
      {url && (
        <div className="relative h-28 w-full overflow-hidden rounded-lg border border-wine/20 bg-wine/5">
          <Image src={url} alt="Header preview" fill className="object-cover" unoptimized />
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
            aria-label="Remove header image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="font-serif text-xs border-wine/30 hover:bg-wine/10"
      >
        {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-2 h-3.5 w-3.5" />}
        {url ? 'Replace header' : 'Upload header'}
      </Button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}

function ExhibitionsField({ profileId }: { profileId: string }) {
  const router = useRouter();
  const empty = { title: '', venue: '', city: '', year: '' };
  const [row, setRow] = useState(empty);
  const [isPending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await addUnclaimedArtistExhibitions({ profileId, exhibitions: [row] });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Exhibition added to the CV');
      setRow(empty);
      router.refresh();
    });

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRow((r) => ({ ...r, [k]: e.target.value }));

  return (
    <div className="space-y-2">
      <Label className="font-serif">Add an exhibition</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input placeholder="Show title" value={row.title} onChange={set('title')} className="font-serif text-sm sm:col-span-2" />
        <Input placeholder="Venue" value={row.venue} onChange={set('venue')} className="font-serif text-sm" />
        <Input placeholder="City" value={row.city} onChange={set('city')} className="font-serif text-sm" />
        <Input placeholder="Year" value={row.year} onChange={set('year')} inputMode="numeric" className="font-serif text-sm" />
      </div>
      <Button
        size="sm"
        onClick={add}
        disabled={isPending || !row.title.trim()}
        className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {isPending ? 'Adding…' : 'Add exhibition'}
      </Button>
    </div>
  );
}

/**
 * Lets signed-in people fill in an artist who isn't on Provenance yet: bio,
 * statement, header image, exhibitions and CV. Every edit is credited to its
 * author, and everything moves to the artist if they claim the profile.
 */
export function UnclaimedArtistContribute({
  profileId,
  artistName,
  signedIn,
  content,
}: {
  profileId: string;
  artistName: string;
  signedIn: boolean;
  content: ContributableContent;
}) {
  const [open, setOpen] = useState(false);

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-dashed border-wine/20 p-5 font-serif text-sm text-ink/70">
        Know {artistName}&apos;s work?{' '}
        <Link
          href={`${pathsConfig.auth.signIn}?next=${encodeURIComponent(`/artists/${profileId}`)}`}
          className="text-wine underline-offset-2 hover:underline"
        >
          Sign in
        </Link>{' '}
        to add their bio, statement, CV or exhibitions.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-wine/20 p-5">
        <p className="font-serif text-sm text-ink/70">
          {artistName} isn&apos;t on Provenance yet. Add what you know; it moves to them if they join.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="font-serif text-xs border-wine/30 hover:bg-wine/10"
          data-testid="contribute-open"
        >
          <PencilLine className="mr-1.5 h-3.5 w-3.5" />
          Add information
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-8 rounded-xl border border-wine/20 bg-parchment/60 p-5 sm:p-6" data-testid="contribute-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={sectionTitle}>Add information</p>
          <p className="font-serif text-sm text-ink/70">
            Your edits are credited to you on this page. If {artistName} claims the profile, everything here moves to
            them and they can change or replace it.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ink/40 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <TextField
          profileId={profileId}
          field="bio"
          label="Bio"
          initial={content.bio}
          placeholder={`A short biography of ${artistName}`}
        />
        <TextField
          profileId={profileId}
          field="artist_statement"
          label="Artist statement"
          initial={content.artist_statement}
          placeholder="The artist's statement, in their words if you have it"
        />
        <ExhibitionsField profileId={profileId} />
        <HeaderImageField profileId={profileId} url={content.header_image_url} />
      </div>
      <CvUploadPanel profileId={profileId} hasExistingFile={content.hasCv} uploadedAt={content.cvUploadedAt} contributor />
    </section>
  );
}
