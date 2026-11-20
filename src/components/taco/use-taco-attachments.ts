'use client';

import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';

import { isLikelyImageFile, prepareImageForUpload } from '~/lib/client-image-upload';
import type { TacoAttachmentRef } from '~/lib/taco/attachments';

export type PendingAttachment = {
  localId: string;
  name: string;
  kind: 'image' | 'document';
  /** Local object URL for images, so the chip shows a thumbnail while uploading. */
  previewUrl: string | null;
  status: 'uploading' | 'ready' | 'error';
  ref?: TacoAttachmentRef;
  error?: string;
};

const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const DOC_EXT = /\.(pdf|docx?|txt|csv)$/i;

let localSeq = 1;

async function upload(file: File): Promise<TacoAttachmentRef> {
  const body = new FormData();
  body.set('file', isLikelyImageFile(file) ? await prepareImageForUpload(file) : file);
  const res = await fetch('/api/taco/attachments', { method: 'POST', body });
  const json = (await res.json().catch(() => ({}))) as TacoAttachmentRef & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Upload failed');
  return json;
}

/**
 * Files dropped, pasted or picked into a Taco chat. Each file uploads as soon
 * as it's added; the chat sends only the ids of the ready ones.
 */
export function useTacoAttachments(opts: { beforeAdd?: () => Promise<boolean> } = {}) {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const { beforeAdd } = opts;

  const patch = (localId: string, next: Partial<PendingAttachment>) =>
    setItems((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...next } : p)));

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.size > 0);
      if (!arr.length) return;
      if (beforeAdd && !(await beforeAdd())) return;

      const accepted: { item: PendingAttachment; file: File }[] = [];
      for (const file of arr) {
        const image = isLikelyImageFile(file);
        const doc = !image && DOC_EXT.test(file.name);
        const item: PendingAttachment = {
          localId: `att-${localSeq++}`,
          name: file.name,
          kind: image ? 'image' : 'document',
          previewUrl: image ? URL.createObjectURL(file) : null,
          status: 'uploading',
        };
        if (!image && !doc) {
          item.status = 'error';
          item.error = 'Use photos, PDF, Word, TXT or CSV';
        } else if (file.size > MAX_FILE_BYTES) {
          item.status = 'error';
          item.error = 'Over 15 MB';
        }
        accepted.push({ item, file });
      }

      setItems((prev) => [...prev, ...accepted.map((a) => a.item)].slice(-MAX_ATTACHMENTS));

      await Promise.all(
        accepted
          .filter((a) => a.item.status === 'uploading')
          .map(async ({ item, file }) => {
            try {
              const ref = await upload(file);
              patch(item.localId, { status: 'ready', ref });
            } catch (err) {
              console.error('[Taco] attachment upload failed', item.name, err);
              patch(item.localId, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
            }
          }),
      );
    },
    [beforeAdd],
  );

  const remove = useCallback((localId: string) => {
    setItems((prev) => {
      const gone = prev.find((p) => p.localId === localId);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  }, []);

  /** Hands back the ready attachments and clears the tray (previews stay valid for the sent message). */
  const take = useCallback((): PendingAttachment[] => {
    const taken = itemsRef.current.filter((p) => p.status === 'ready');
    const ids = new Set(taken.map((t) => t.localId));
    // Failed chips are dropped too; ones still uploading stay for the next message.
    setItems((prev) => prev.filter((p) => !ids.has(p.localId) && p.status !== 'error'));
    return taken;
  }, []);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
    },
  };

  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
      }
    },
    [addFiles],
  );

  return {
    items,
    addFiles,
    remove,
    take,
    isDragging,
    dropHandlers,
    onPaste,
    isUploading: items.some((i) => i.status === 'uploading'),
    readyCount: items.filter((i) => i.status === 'ready').length,
  };
}

export const TACO_FILE_ACCEPT = 'image/*,.heic,.heif,.pdf,.docx,.doc,.txt,.csv';
