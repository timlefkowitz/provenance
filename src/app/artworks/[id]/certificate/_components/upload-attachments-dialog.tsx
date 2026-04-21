'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ChevronDown, FileText, Trash2, ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
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
  created_at: string;
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

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log('[UploadAttachmentsDialog] add attachment', { artworkId, fileName: file.name });
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await addArtworkAttachment(artworkId, formData);
        if (result.success) {
          toast.success('Attachment added.');
          router.refresh();
        } else {
          toast.error(result.error || 'Upload failed');
        }
      } catch (err) {
        console.error('[UploadAttachmentsDialog] attachment failed', err);
        toast.error('Upload failed');
      } finally {
        if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      }
    });
  };

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
    <Dialog open={open} onOpenChange={setOpen}>
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
          onChange={handleAttachment}
        />

        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ImageIcon className="h-4 w-4 text-wine" aria-hidden />
              Main image
            </div>
            <p className="text-xs text-muted-foreground">
              Shown at the top of the certificate. JPEG, PNG, WebP, or GIF (max 10 MB via edit flow).
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

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 text-wine" aria-hidden />
              Attachments
            </div>
            <p className="text-xs text-muted-foreground">
              Extra images or PDFs listed on the certificate (max 15 MB each).
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => attachmentInputRef.current?.click()}
            >
              {pending ? 'Working…' : 'Add photo or document'}
            </Button>

            {attachments.length > 0 && (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-md border border-wine/20 bg-parchment/50 p-2">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate" title={a.file_name}>
                      {a.file_type === 'document' ? (
                        <FileText className="mr-1 inline h-3.5 w-3.5 shrink-0 text-wine" />
                      ) : (
                        <ImageIcon className="mr-1 inline h-3.5 w-3.5 shrink-0 text-wine" />
                      )}
                      {a.file_name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={pending}
                      onClick={() => handleDeleteAttachment(a.id)}
                      aria-label={`Remove ${a.file_name}`}
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
