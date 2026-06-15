'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Globe, Lock, Loader2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import {
  publishExhibition,
  unpublishExhibition,
} from '../_actions/publish-exhibition';

export function ExhibitionPublishBanner({
  exhibitionId,
  publishedAt,
}: {
  exhibitionId: string;
  publishedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const isPublished = Boolean(publishedAt);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/exhibitions/${exhibitionId}`
      : `/exhibitions/${exhibitionId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[ExhibitionPublishBanner] copy link failed', error);
      toast.error('Could not copy link');
    }
  };

  const handlePublish = () => {
    startTransition(async () => {
      try {
        const result = await publishExhibition(exhibitionId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('Exhibition published');
        router.refresh();
      } catch (error) {
        console.error('[ExhibitionPublishBanner] publish failed', error);
        toast.error(error instanceof Error ? error.message : 'Failed to publish');
      }
    });
  };

  const handleUnpublish = () => {
    startTransition(async () => {
      try {
        const result = await unpublishExhibition(exhibitionId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('Exhibition is now private');
        router.refresh();
      } catch (error) {
        console.error('[ExhibitionPublishBanner] unpublish failed', error);
        toast.error(error instanceof Error ? error.message : 'Failed to unpublish');
      }
    });
  };

  if (isPublished) {
    return (
      <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Globe className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-serif text-emerald-900 font-medium">Published</p>
            <p className="text-xs font-serif text-emerald-800/70 truncate mt-0.5">{shareUrl}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-serif border-emerald-300 text-emerald-800 hover:bg-emerald-100"
            onClick={handleCopyLink}
            disabled={pending}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy Link
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-serif text-emerald-800/70 hover:text-emerald-900"
            onClick={handleUnpublish}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Unpublish'}
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="font-serif border-wine/25 text-wine"
          >
            <Link href={`/exhibitions/${exhibitionId}/edit#artworks`}>Manage listings</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <Lock className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-serif text-amber-950 font-medium">Private draft</p>
          <p className="text-sm font-serif text-amber-900/75 mt-0.5">
            This exhibition is private. Publish it to share with collectors and art lovers.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          size="sm"
          className="font-serif bg-wine text-parchment hover:bg-wine/90"
          onClick={handlePublish}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Publishing…
            </>
          ) : (
            'Publish Exhibition'
          )}
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="font-serif border-wine/25 text-wine"
        >
          <Link href={`/exhibitions/${exhibitionId}/edit#artworks`}>Manage listings</Link>
        </Button>
      </div>
    </div>
  );
}
