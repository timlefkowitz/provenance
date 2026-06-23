'use client';

import { useCallback, useState, useRef } from 'react';
import { Button } from '@kit/ui/button';
import { Upload, FileText, Loader2, Sparkles } from 'lucide-react';
import { uploadArtistCv } from '../_actions/upload-artist-cv';
import { useRouter } from 'next/navigation';

export function UploadCvForm() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setError(result.error ?? 'Upload failed');
      }
    },
    [router],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      setFileName(file.name);
    }
  }

  return (
    <div className="rounded-2xl border border-wine/15 bg-gradient-to-br from-parchment/80 to-white overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 h-9 w-9 rounded-xl bg-wine/8 flex items-center justify-center">
            <Sparkles className="h-4.5 w-4.5 text-wine/70" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-wine text-base leading-none mb-1">
              Personalise your recommendations
            </h3>
            <p className="text-ink/60 font-serif text-sm leading-relaxed">
              Upload your CV or resume (PDF, Word, or text) so Taco can match grants to your
              exact practice — or browse the curated list below without uploading.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all ${
              dragging
                ? 'border-wine bg-wine/5'
                : 'border-wine/20 hover:border-wine/40 hover:bg-wine/3'
            }`}
          >
            <FileText className="h-6 w-6 text-wine/40 mx-auto mb-2" />
            {fileName ? (
              <p className="font-serif text-sm text-wine font-medium">{fileName}</p>
            ) : (
              <p className="font-serif text-sm text-ink/50">
                Drop your CV here, or <span className="text-wine underline">browse</span>
              </p>
            )}
            <p className="text-[11px] text-ink/35 font-serif mt-1">PDF · Word · TXT</p>
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          {error && <p className="text-red-600 text-sm font-serif">{error}</p>}

          <Button
            type="submit"
            disabled={uploading || !fileName}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif w-full gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing CV…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload CV
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
