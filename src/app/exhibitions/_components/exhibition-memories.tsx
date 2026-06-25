'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Camera, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { useRouter } from 'next/navigation';
import {
  deleteExhibitionMemory,
  postExhibitionMemory,
  type ExhibitionMemory,
} from '../_actions/exhibition-memories';

const MAX_IMAGES = 4;

type PendingImage = {
  key: string;
  file: File;
  /** Blob object-URL for JPEG/PNG/WebP; null for HEIC (server converts, no browser preview). */
  previewUrl: string | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function initials(name: string | null): string {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function ExhibitionMemories({
  exhibitionId,
  initialMemories,
  canPost,
  currentUserId,
  isOwner,
}: {
  exhibitionId: string;
  initialMemories: ExhibitionMemory[];
  canPost: boolean;
  currentUserId: string | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [memories, setMemories] = useState<ExhibitionMemory[]>(initialMemories);
  const [body, setBody] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [posting, startPosting] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMemories(initialMemories);
  }, [initialMemories]);

  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHeicFile = (file: File): boolean => {
    const mime = file.type.toLowerCase();
    if (mime === 'image/heic' || mime === 'image/heif') return true;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ext === 'heic' || ext === 'heif';
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    // Accept standard images plus HEIC/HEIF from iPhone (server converts them).
    const incoming = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || isHeicFile(f),
    );
    setImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_IMAGES} photos.`);
        return prev;
      }
      const next = incoming.slice(0, room).map((file) => ({
        key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        // HEIC files can't be previewed in Chrome/Firefox — skip the blob URL
        // so the upload still works. The server converts them to JPEG.
        previewUrl: isHeicFile(file) ? null : URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  };

  const removeImage = (key: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  };

  const resetForm = () => {
    images.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setImages([]);
    setBody('');
  };

  const handlePost = () => {
    if (!body.trim() && images.length === 0) {
      toast.error('Add a photo or a note to share a memory.');
      return;
    }
    startPosting(async () => {
      try {
        const fd = new FormData();
        fd.append('exhibitionId', exhibitionId);
        fd.append('body', body.trim());
        images.forEach((img, i) => fd.append(`image_${i}`, img.file));

        const result = await postExhibitionMemory(fd);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setMemories((prev) => [result.memory, ...prev]);
        resetForm();
        toast.success('Your memory was shared.');
        router.refresh();
      } catch (e: unknown) {
        console.error('[ExhibitionMemories] post failed', e);
        toast.error(e instanceof Error ? e.message : 'Failed to share memory');
      }
    });
  };

  const handleDelete = (memoryId: string) => {
    setDeletingId(memoryId);
    startPosting(async () => {
      try {
        const result = await deleteExhibitionMemory(memoryId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        toast.success('Memory removed.');
        router.refresh();
      } catch (e: unknown) {
        console.error('[ExhibitionMemories] delete failed', e);
        toast.error(e instanceof Error ? e.message : 'Failed to remove memory');
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-10">
      {/* Composer */}
      {canPost ? (
        <div className="rounded-2xl border border-wine/15 bg-parchment/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-4">
            Share a Memory
          </p>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you love about this show? Add a note…"
            rows={3}
            className="w-full resize-none rounded-lg border border-wine/15 bg-white/60 px-3 py-2.5 font-serif text-sm text-ink placeholder:text-ink/35 focus:border-wine/40 focus:outline-none"
          />

          {images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {images.map((img) => (
                <div
                  key={img.key}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-wine/15 bg-parchment/60"
                >
                  {img.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    // HEIC files can't be previewed in the browser; show a
                    // filename placeholder — the server converts them to JPEG on upload.
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center">
                      <Camera className="h-5 w-5 text-wine/40" />
                      <span className="text-[9px] font-serif text-ink/40 leading-tight break-all line-clamp-2">
                        {img.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(img.key)}
                    className="absolute right-1 top-1 rounded-full bg-black/55 p-0.5 text-white hover:bg-black/80"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,image/heic,image/heif"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-serif text-xs border-wine/25 h-8"
              disabled={posting || images.length >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Add photos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-serif text-xs border-wine/25 h-8 sm:hidden"
              disabled={posting || images.length >= MAX_IMAGES}
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              Take photo
            </Button>
            <Button
              type="button"
              size="sm"
              className="font-serif text-xs h-8 bg-wine text-parchment hover:bg-wine/90 ml-auto"
              disabled={posting}
              onClick={handlePost}
            >
              {posting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Sharing…
                </>
              ) : (
                'Share memory'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-wine/15 bg-parchment/30 p-6 text-center">
          <p className="font-serif text-sm text-ink/55">
            <Link href="/auth/sign-in" className="text-wine underline underline-offset-2">
              Sign in
            </Link>{' '}
            to share a memory of this exhibition.
          </p>
        </div>
      )}

      {/* Memories feed */}
      {memories.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-wine/15 rounded-2xl">
          <ImagePlus className="h-8 w-8 text-wine/20 mx-auto mb-3" />
          <p className="text-[10px] uppercase tracking-widest text-ink/25 font-serif mb-2">
            No Memories Yet
          </p>
          <p className="text-ink/35 font-serif text-sm">
            Be the first to share a memory from this show.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          {memories.map((memory) => {
            const canDelete = isOwner || memory.user_id === currentUserId;
            const imgCount = memory.image_urls.length;
            return (
              <div
                key={memory.id}
                className="group relative rounded-2xl border border-wine/12 bg-white overflow-hidden shadow-sm"
              >
                {/* Author header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-wine/8">
                  {memory.author_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={memory.author_avatar_url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wine/12 text-xs font-serif font-semibold text-wine shrink-0">
                      {initials(memory.author_name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-sm font-semibold text-ink/85 leading-tight truncate">
                      {memory.author_name?.trim() || 'A visitor'}
                    </p>
                    <p className="font-serif text-[11px] text-ink/40 leading-tight mt-0.5">
                      {formatWhen(memory.created_at)}
                    </p>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(memory.id)}
                      disabled={deletingId === memory.id || posting}
                      aria-label="Delete memory"
                      className="shrink-0 h-8 w-8 rounded-full text-ink/30 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:cursor-not-allowed"
                    >
                      {deletingId === memory.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Photos — full width, layout adapts to count */}
                {imgCount > 0 && (
                  <div
                    className={
                      imgCount === 1
                        ? ''
                        : imgCount === 2
                        ? 'grid grid-cols-2 gap-0.5'
                        : imgCount === 3
                        ? 'grid grid-cols-2 gap-0.5'
                        : 'grid grid-cols-2 gap-0.5'
                    }
                  >
                    {memory.image_urls.map((url, i) => {
                      // For 3 images: first photo spans full width, next two split
                      const isFirstOfThree = imgCount === 3 && i === 0;
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${memory.id}-${i}`}
                          src={url}
                          alt=""
                          loading="lazy"
                          className={[
                            'w-full object-cover block',
                            imgCount === 1 ? 'max-h-[520px]' : 'aspect-square',
                            isFirstOfThree ? 'col-span-2 aspect-video' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Caption */}
                {memory.body && (
                  <div className="px-4 py-3">
                    <p className="font-serif text-sm text-ink/70 leading-relaxed whitespace-pre-wrap">
                      {memory.body}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
