'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Upload, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { uploadArtistCv } from '~/app/grants/_actions/upload-artist-cv';
import { getOriginalCvSignedUrl } from '../_actions/get-original-cv-signed-url';

type Props = {
  /** The artist user_profile id — needed to mint the signed URL. */
  profileId: string;
  hasExistingFile: boolean;
  uploadedAt: string | null;
};

export function CvUploadPanel({ profileId, hasExistingFile, uploadedAt }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setUploadError(null);
      const form = e.currentTarget;
      const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      if (!file) {
        setUploadError('Please select a file first');
        return;
      }
      console.log('[ArtistCV] CvUploadPanel upload started', { name: file.name, type: file.type });
      setUploading(true);
      const result = await uploadArtistCv(new FormData(form));
      setUploading(false);
      if (result.success) {
        console.log('[ArtistCV] CvUploadPanel upload success, refreshing');
        router.refresh();
      } else {
        console.error('[ArtistCV] CvUploadPanel upload error', result.error);
        setUploadError(result.error);
      }
    },
    [router],
  );

  const handleDownload = useCallback(async () => {
    setDownloadError(null);
    setDownloadLoading(true);
    console.log('[ArtistCV] CvUploadPanel download started', { profileId });
    const result = await getOriginalCvSignedUrl(profileId);
    setDownloadLoading(false);
    if (result.success) {
      console.log('[ArtistCV] CvUploadPanel download URL received');
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } else {
      console.error('[ArtistCV] CvUploadPanel download error', result.error);
      setDownloadError(result.error);
    }
  }, [profileId]);

  return (
    <div className="rounded-xl border border-wine/20 bg-parchment/60 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-wine/70 flex-shrink-0" />
        <p className="font-serif text-sm font-semibold text-ink">
          {hasExistingFile ? 'Replace your CV' : 'Upload your CV'}
        </p>
      </div>

      {hasExistingFile && uploadedAt && (
        <p className="text-xs font-serif text-ink/45">
          Last updated{' '}
          {new Date(uploadedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}

      <p className="text-xs font-serif text-ink/60 leading-relaxed">
        Upload a PDF, Word, or plain-text CV. We&apos;ll extract the structured data
        and merge it with your Provenance exhibitions.
      </p>

      <form onSubmit={handleUpload} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
          className="block w-full text-xs font-serif text-ink/70 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-wine/10 file:text-wine file:font-medium file:text-xs file:cursor-pointer"
        />
        {uploadError && (
          <p className="text-red-600 text-xs font-serif">{uploadError}</p>
        )}
        <Button
          type="submit"
          disabled={uploading}
          size="sm"
          className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Uploading & extracting…
            </>
          ) : (
            <>
              {hasExistingFile ? (
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-2" />
              )}
              {hasExistingFile ? 'Replace CV' : 'Upload CV'}
            </>
          )}
        </Button>
      </form>

      {hasExistingFile && (
        <div className="border-t border-wine/10 pt-3">
          {downloadError && (
            <p className="text-red-600 text-xs font-serif mb-2">{downloadError}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={downloadLoading}
            onClick={handleDownload}
            className="font-serif text-xs border-wine/25 hover:bg-wine/8 w-full"
          >
            {downloadLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Generating link…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-2" />
                Download original file
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
