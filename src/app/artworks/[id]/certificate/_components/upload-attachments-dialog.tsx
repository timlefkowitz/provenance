'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ChevronDown, FileText, Trash2, ImageIcon, Globe, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { editArtwork } from '../_actions/edit-artwork';
import { addArtworkAttachment } from '../../_actions/add-artwork-attachment';
import { deleteArtworkAttachment } from '../../_actions/delete-artwork-attachment';

export type ArtworkAttachmentRow = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'image' | 'document';
  label: string | null;
  is_public: boolean;
  created_at: string;
};

type PendingFile = {
  file: File;
  label: string;
  isPublic: boolean;
};

export function UploadAttachmentsDialog({
  artworkId,
  artworkTitle,
  attachments,
  isCreatorForEdit,
}: {
  artworkId: string;
  artworkTitle: string;
  attachments: ArtworkAttachmentRow[];
  isCreatorForEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // State for the "pending file" mini-form shown after picking a file
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);

  // ── Main image replacement ─────────────────────────────────────────────────
  const handleMainImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log('[UploadAttachmentsDialog] replace main image', { artworkId, fileName: file.name });
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('image', file);
        const result = await editArtwork(artworkId, formData, isCreatorForEdit);
        if (result.success) {
          toast.success('Main image updated.');
          router.refresh();
        } else {
          toast.error(result.error || 'Could not update image');
        }
      } catch (err) {
        console.error('[UploadAttachmentsDialog] main image failed', err);
        toast.error('Could not update image');
      } finally {
        if (mainImageInputRef.current) mainImageInputRef.current.value = '';
      }
    });
  };

  // ── Pick attachment — show mini-form instead of uploading immediately ──────
  const handlePickAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Pre-fill label with the filename (stripped of extension) as a helpful default
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
    setPendingFile({ file, label: nameWithoutExt, isPublic: true });
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleCancelPending = () => setPendingFile(null);

  const handleConfirmAttachment = () => {
    if (!pendingFile) return;
    console.log('[UploadAttachmentsDialog] confirm attachment', { artworkId, fileName: pendingFile.file.name, label: pendingFile.label, isPublic: pendingFile.isPublic });
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('file', pendingFile.file);
        formData.append('label', pendingFile.label.trim());
        formData.append('is_public', String(pendingFile.isPublic));
        const result = await addArtworkAttachment(artworkId, formData);
        if (result.success) {
          toast.success('Attachment added.');
          setPendingFile(null);
          router.refresh();
        } else {
          toast.error(result.error || 'Upload failed');
        }
      } catch (err) {
        console.error('[UploadAttachmentsDialog] attachment failed', err);
        toast.error('Upload failed');
      }
    });
  };

  // ── Delete existing attachment ─────────────────────────────────────────────
  const handleDeleteAttachment = (attachmentId: string) => {
    startTransition(async () => {
      try {
        const result = await deleteArtworkAttachment(attachmentId);
        if (result.success) {
          toast.success('Attachment removed.');
          router.refresh();
        } else {
          toast.error(result.error || 'Could not remove');
        }
      } catch (err) {
        console.error('[UploadAttachmentsDialog] delete failed', err);
        toast.error('Could not remove attachment');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPendingFile(null); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="font-serif text-xs sm:text-sm gap-1.5"
          size="sm"
          disabled={pending}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Upload
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md font-serif sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload to certificate</DialogTitle>
          <DialogDescription>
            Replace the main artwork image or add supporting photos and PDFs for{' '}
            <span className="font-medium text-foreground">{artworkTitle || 'this work'}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file inputs */}
        <input
          ref={mainImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleMainImage}
        />
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handlePickAttachment}
        />

        <div className="space-y-6 py-2">

          {/* ── Main image section ─────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ImageIcon className="h-4 w-4 text-wine" aria-hidden />
              Main image
            </div>
            <p className="text-xs text-muted-foreground">
              Shown at the top of the certificate. JPEG, PNG, WebP, or GIF (max 10 MB).
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => mainImageInputRef.current?.click()}
            >
              {pending ? 'Working…' : 'Choose new main image'}
            </Button>
          </section>

          <Separator />

          {/* ── Attachments section ────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 text-wine" aria-hidden />
              Attachments
            </div>
            <p className="text-xs text-muted-foreground">
              Extra images or PDFs listed on the certificate (max 15 MB each).
            </p>

            {/* Pending-file mini-form */}
            {pendingFile ? (
              <div className="rounded-md border border-wine/30 bg-wine/5 p-4 space-y-4">
                <p className="text-xs font-medium text-wine truncate" title={pendingFile.file.name}>
                  Selected: {pendingFile.file.name}
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="att-label" className="text-xs">
                    Display name
                  </Label>
                  <Input
                    id="att-label"
                    value={pendingFile.label}
                    onChange={(e) => setPendingFile((prev) => prev ? { ...prev, label: e.target.value } : null)}
                    placeholder="e.g. Provenance letter, Exhibition photo…"
                    className="h-8 text-sm font-serif"
                    maxLength={200}
                    disabled={pending}
                  />
                  <p className="text-xs text-muted-foreground">Shown on the certificate. Leave blank to use the file name.</p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="att-public" className="text-xs font-medium">
                      Visibility
                    </Label>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {pendingFile.isPublic
                        ? <><Globe className="h-3 w-3 text-wine" /> Public — visible to everyone</>
                        : <><Lock className="h-3 w-3" /> Private — only you can see this</>}
                    </p>
                  </div>
                  <Switch
                    id="att-public"
                    checked={pendingFile.isPublic}
                    onCheckedChange={(v) => setPendingFile((prev) => prev ? { ...prev, isPublic: v } : null)}
                    disabled={pending}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-wine text-parchment hover:bg-wine/90 font-serif"
                    disabled={pending}
                    onClick={handleConfirmAttachment}
                  >
                    {pending ? 'Uploading…' : 'Upload'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-serif"
                    disabled={pending}
                    onClick={handleCancelPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => attachmentInputRef.current?.click()}
              >
                Add photo or document
              </Button>
            )}

            {/* Existing attachments list */}
            {attachments.length > 0 && (
              <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-md border border-wine/20 bg-parchment/50 p-2">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-center gap-1 truncate" title={a.label ?? a.file_name}>
                        {a.file_type === 'document'
                          ? <FileText className="h-3.5 w-3.5 shrink-0 text-wine" />
                          : <ImageIcon className="h-3.5 w-3.5 shrink-0 text-wine" />}
                        <span className="truncate font-medium">{a.label ?? a.file_name}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {a.is_public
                          ? <><Globe className="h-3 w-3" /> Public</>
                          : <><Lock className="h-3 w-3" /> Private</>}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={pending}
                      onClick={() => handleDeleteAttachment(a.id)}
                      aria-label={`Remove ${a.label ?? a.file_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
