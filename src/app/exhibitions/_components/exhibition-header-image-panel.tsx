'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ImagePlus } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import {
  BUTTON_SECONDARY,
  EditorialSectionHeader,
  FIELD_HINT,
  FIELD_LABEL,
} from '~/components/editorial-form';
import { updateExhibitionHeaderImage } from '../_actions/update-exhibition-header-image';

type HeaderArtwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
};

/**
 * Lets the exhibition's managers pick the image that leads its page: upload
 * one, or use an artwork already in the show. Saves as soon as a choice is made.
 */
export function ExhibitionHeaderImagePanel({
  exhibitionId,
  initialImageUrl,
  initialArtworkId,
  artworks,
}: {
  exhibitionId: string;
  initialImageUrl: string | null;
  initialArtworkId: string | null;
  artworks: HeaderArtwork[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [artworkId, setArtworkId] = useState<string | null>(initialArtworkId);
  const [savingArtworkId, setSavingArtworkId] = useState<string | null>(null);

  const withImages = artworks.filter((a) => a.image_url?.trim());

  const save = (formData: FormData, successMessage: string) => {
    startTransition(async () => {
      const result = await updateExhibitionHeaderImage(exhibitionId, formData);
      setSavingArtworkId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setImageUrl(result.imageUrl);
      setArtworkId(result.artworkId);
      toast.success(successMessage);
      router.refresh();
    });
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    save(formData, 'Header image updated');
  };

  const handleArtworkPicked = (id: string) => {
    if (id === artworkId || pending) return;
    setSavingArtworkId(id);
    const formData = new FormData();
    formData.append('artworkId', id);
    save(formData, 'Header image updated');
  };

  const handleRemove = () => {
    const formData = new FormData();
    formData.append('remove', '1');
    save(formData, 'Header image removed');
  };

  return (
    <section id="header-image" className="mt-16 scroll-mt-8 border-t border-editorial-border/30 pt-10">
      <EditorialSectionHeader
        eyebrow="Header image"
        title="Lead the exhibition page with an image"
        description="Upload an installation shot or poster, or use one of the artworks in this show. It also shows when the exhibition link is shared."
      />

      <div className="border border-editorial-border/25 bg-bone">
        <div className="grid gap-0 sm:grid-cols-[minmax(0,20rem)_1fr]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            aria-label={imageUrl ? 'Replace header image' : 'Upload a header image'}
            className={cn(
              'group relative flex aspect-[16/9] items-center justify-center overflow-hidden border-b border-editorial-border/25 bg-cream/50 transition-colors sm:border-b-0 sm:border-r',
              'hover:bg-vermillion/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vermillion/30',
              pending && 'cursor-wait',
            )}
          >
            {imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-editorial-ink/80 py-2 text-center font-jetbrains text-[10px] uppercase tracking-[0.18em] text-bone opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Upload a different image
                </span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-2 px-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center bg-vermillion/10 text-vermillion transition-all duration-300 group-hover:scale-105 group-hover:bg-vermillion group-hover:text-bone">
                  <ImagePlus className="h-4 w-4" />
                </span>
                <span className="font-jetbrains text-[10px] uppercase tracking-[0.18em] text-editorial-ink/70">
                  {pending ? 'Saving…' : 'Upload image'}
                </span>
              </span>
            )}
            {pending && imageUrl && (
              <span className="absolute inset-0 flex items-center justify-center bg-bone/70 font-jetbrains text-[10px] uppercase tracking-[0.18em] text-editorial-ink">
                Saving…
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            className="hidden"
            onChange={handleFilePicked}
          />

          <div className="flex flex-col justify-between gap-4 p-5">
            <div>
              <p className={FIELD_LABEL}>
                {imageUrl ? (artworkId ? 'Using an artwork' : 'Using an uploaded image') : 'No header image'}
              </p>
              <p className={cn(FIELD_HINT, 'mt-2 text-sm')}>
                A wide, landscape image works best. Without one, the page opens with the title.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending}
                className={cn(BUTTON_SECONDARY, 'h-9 px-4')}
              >
                {imageUrl ? 'Upload new' : 'Upload image'}
              </Button>
              {imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={pending}
                  className={cn(BUTTON_SECONDARY, 'h-9 border-transparent px-4 text-editorial-ink/60 hover:text-vermillion')}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-editorial-border/25 p-5">
          <p className={FIELD_LABEL}>Or use an artwork from this show</p>
          {withImages.length === 0 ? (
            <p className={cn(FIELD_HINT, 'mt-2 text-sm')}>
              Artworks with images will appear here once they are added to the exhibition.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {withImages.map((artwork) => {
                const selected = artwork.id === artworkId;
                const saving = artwork.id === savingArtworkId;
                return (
                  <li key={artwork.id}>
                    <button
                      type="button"
                      onClick={() => handleArtworkPicked(artwork.id)}
                      disabled={pending}
                      aria-pressed={selected}
                      title={artwork.artist_name ? `${artwork.title} — ${artwork.artist_name}` : artwork.title}
                      className={cn(
                        'group relative block aspect-square w-full overflow-hidden border bg-cream/50 transition',
                        selected
                          ? 'border-vermillion ring-2 ring-vermillion/40'
                          : 'border-editorial-border/25 hover:border-editorial-ink/40',
                        pending && !saving && 'opacity-60',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion/40',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artwork.image_url!}
                        alt={artwork.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {selected && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-vermillion text-bone">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      {saving && (
                        <span className="absolute inset-0 flex items-center justify-center bg-bone/70 font-jetbrains text-[9px] uppercase tracking-[0.18em] text-editorial-ink">
                          Saving…
                        </span>
                      )}
                    </button>
                    <p className="mt-1 truncate font-serif text-xs text-editorial-ink/60">{artwork.title}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
