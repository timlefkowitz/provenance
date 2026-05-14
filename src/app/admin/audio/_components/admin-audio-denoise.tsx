'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { MAX_AUDIO_UPLOAD_BYTES } from '~/lib/audio-denoise/constants';

const ACCEPT =
  'audio/*,.m4a,.mp4,.mov,.wav,.aac,.mp3,.caf,.aiff,.aif,audio/mp4,audio/x-m4a,audio/aac';

type Phase = 'idle' | 'checking' | 'processing' | 'success' | 'error';

function formatMaxMb(): string {
  return String(Math.floor(MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024)));
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const quoted = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(header);
  if (quoted) {
    const raw = quoted[1] ?? quoted[2];
    if (raw) {
      try {
        return decodeURIComponent(raw.replace(/\+/g, ' '));
      } catch {
        return raw;
      }
    }
  }
  const plain = /filename=([^;]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^"|"$/g, '');
  return null;
}

export function AdminAudioDenoise() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lastFileLabel, setLastFileLabel] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setMessage(null);
    setLastFileLabel(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const processFile = useCallback(async (file: File) => {
    setMessage(null);
    setLastFileLabel(file.name || 'recording');

    if (file.size === 0) {
      setPhase('error');
      setMessage('That file is empty. Pick a different recording.');
      return;
    }

    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      setPhase('error');
      setMessage(`File is too large. Maximum size is ${formatMaxMb()} MB (matches admin upload limits).`);
      return;
    }

    setPhase('checking');
    await new Promise((r) => setTimeout(r, 50));

    setPhase('processing');
    const fd = new FormData();
    fd.set('file', file);

    let response: Response;
    try {
      response = await fetch('/api/admin/audio/denoise', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
    } catch (e) {
      console.error('[AdminAudioDenoise] network error', e);
      setPhase('error');
      setMessage('Network error. Check your connection and try again.');
      return;
    }

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const j = (await response.json()) as { error?: string };
        if (j?.error) detail = j.error;
      } catch {
        /* use default */
      }
      setPhase('error');
      setMessage(detail);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const filename =
      parseFilenameFromDisposition(response.headers.get('Content-Disposition')) ?? 'denoised.m4a';

    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }

    setPhase('success');
    setMessage('Download started. Check your downloads folder.');
  }, []);

  const onPickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void processFile(files[0]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onPickFiles(e.dataTransfer.files);
  };

  const busy = phase === 'checking' || phase === 'processing';

  return (
    <div className="space-y-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio file or drop recording here"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={[
          'rounded-sm border border-dashed px-5 py-10 text-center transition-colors',
          'border-[#1793d1]/35 bg-[#12151c] shadow-[inset_0_1px_0_0_rgba(23,147,209,0.08)]',
          dragOver ? 'border-[#67d4ff]/60 bg-[#161c26]' : '',
          busy ? 'cursor-wait opacity-80' : 'cursor-pointer hover:border-[#1793d1]/55 hover:bg-[#161c26]',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => onPickFiles(e.target.files)}
        />

        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#67d4ff]" aria-hidden />
            <p className="font-mono text-sm text-slate-300">
              {phase === 'checking' ? 'Checking file…' : 'Cleaning noise…'}
            </p>
            <p className="max-w-md font-mono text-[11px] leading-relaxed text-slate-500">
              This usually takes a few seconds; the first run after a deploy can take longer. Server limit is
              about one minute per request.
            </p>
          </div>
        ) : (
          <>
            <p className="font-mono text-sm text-[#67d4ff]">Drop a recording here</p>
            <p className="mt-2 font-mono text-[12px] text-slate-500">or click to choose a file</p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">
              max {formatMaxMb()} MB · m4a, wav, aac, mp3, mov…
            </p>
          </>
        )}
      </div>

      <div className="rounded-sm border border-[#1793d1]/25 bg-[#0f1318] px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-500">
        <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#1793d1]/85">from an iPhone or Mac</p>
        <ul className="list-inside list-disc space-y-1 text-slate-400">
          <li>Voice Memos: open the memo → Share → Save to Files, then upload the exported file here.</li>
          <li>Safari may label exports as M4A or MP4; both work if they are audio.</li>
        </ul>
      </div>

      {phase === 'success' && message && (
        <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-mono text-sm text-emerald-200/90">
          <p>{message}</p>
          {lastFileLabel && (
            <p className="mt-1 text-[11px] text-emerald-200/60">Source: {lastFileLabel}</p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-sm border border-emerald-500/40 px-3 py-1.5 font-mono text-[11px] text-emerald-100 hover:bg-emerald-500/15"
          >
            Process another file
          </button>
        </div>
      )}

      {phase === 'error' && message && (
        <div className="rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-200/90">
          <p>{message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-sm border border-red-500/40 px-3 py-1.5 font-mono text-[11px] text-red-100 hover:bg-red-500/15"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
