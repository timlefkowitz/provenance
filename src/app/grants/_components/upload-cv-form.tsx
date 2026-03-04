'use client';

import { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Upload, FileText } from 'lucide-react';
import { uploadArtistCv } from '../_actions/upload-artist-cv';
import { useRouter } from 'next/navigation';

export function UploadCvForm() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      const form = e.currentTarget;
      const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      if (!file) {
        setError('Please select a file');
        return;
      }
      console.log('[Grants] UploadCvForm submit', file.name, file.type);
      setUploading(true);
      const result = await uploadArtistCv(new FormData(form));
      setUploading(false);
      if (result.success) {
        console.log('[Grants] UploadCvForm success, refreshing');
        router.refresh();
      } else {
        console.error('[Grants] UploadCvForm error', result.error);
        setError(result.error);
      }
    },
    [router]
  );

  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardHeader>
        <CardTitle className="font-display text-xl text-wine flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload your artist CV or resume
        </CardTitle>
        <p className="text-ink/70 font-serif text-sm">
          Upload a PDF, Word (DOCX), or text file. We&apos;ll extract your practice and location to match you with relevant grants.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,.doc,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/csv"
            className="block w-full text-sm font-serif text-ink file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-wine file:text-parchment file:font-medium"
          />
          {error && <p className="text-red-600 text-sm font-serif">{error}</p>}
          <Button
            type="submit"
            disabled={uploading}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            {uploading ? (
              'Uploading…'
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload CV
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
