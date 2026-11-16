'use client';

import { useState, useTransition } from 'react';
import { toast } from '@kit/ui/sonner';
import { loadGalleryWorks } from '../_actions/load-gallery-works';
import { getTemplateComponent, type ArtistTemplateProps, type TemplateId } from './template-registry';

/**
 * Renders a profile template for a gallery / institution and pages in more
 * Certificates of Show below its works list, using the template's own colors.
 */
export function TemplateWorksPager({
  templateId,
  templateProps,
  galleryProfileId,
  total,
}: {
  templateId: TemplateId;
  templateProps: ArtistTemplateProps;
  galleryProfileId: string;
  total: number;
}) {
  const [artworks, setArtworks] = useState(templateProps.artworks);
  const [exhausted, setExhausted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const Template = getTemplateComponent(templateId);
  if (!Template) return null;

  const remaining = Math.max(0, total - artworks.length);

  const loadMore = () => {
    startTransition(async () => {
      const result = await loadGalleryWorks(galleryProfileId, artworks.length);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.artworks.length === 0) {
        setExhausted(true);
        return;
      }
      setArtworks((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...result.artworks.filter((a) => !seen.has(a.id))];
      });
    });
  };

  const footer =
    remaining > 0 && !exhausted ? (
      <div className="flex flex-col items-center gap-2 py-12 px-6">
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          className="rounded-full border border-current px-6 py-2 font-serif text-sm opacity-80 hover:opacity-100 transition-opacity disabled:opacity-40"
        >
          {isPending ? 'Loading…' : 'See more'}
        </button>
        <p className="font-serif text-xs opacity-50">
          Showing {artworks.length} of {total}
        </p>
      </div>
    ) : null;

  return (
    <Template {...templateProps} artworks={artworks} artworksTotal={total} worksFooter={footer} />
  );
}
