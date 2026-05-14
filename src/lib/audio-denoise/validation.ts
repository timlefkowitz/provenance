import path from 'node:path';

import { z } from 'zod';

import { MAX_AUDIO_UPLOAD_BYTES } from './constants';

export { MAX_AUDIO_UPLOAD_BYTES } from './constants';

const ALLOWED_EXTENSIONS = new Set([
  '.m4a',
  '.mp4',
  '.mov',
  '.wav',
  '.aac',
  '.mp3',
  '.caf',
  '.aiff',
  '.aif',
]);

const EXPLICIT_MIMES = new Set([
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/x-caf',
  'audio/aiff',
  'audio/x-aiff',
  'video/mp4',
  'video/quicktime',
]);

const mimeToExt: Record<string, string> = {
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/x-caf': '.caf',
  'audio/aiff': '.aiff',
  'audio/x-aiff': '.aiff',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
};

const uploadShape = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().int().nonnegative(),
});

export type ValidateAudioUploadOk = {
  ok: true;
  sizeBytes: number;
  mimeType: string;
  inputExtension: string;
};

export type ValidateAudioUploadErr = {
  ok: false;
  message: string;
  status: 400 | 413;
};

export type ValidateAudioUploadResult = ValidateAudioUploadOk | ValidateAudioUploadErr;

function extensionFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

function mimeAllowed(mime: string): boolean {
  const t = mime.trim().toLowerCase();
  if (!t) return false;
  if (EXPLICIT_MIMES.has(t)) return true;
  if (t.startsWith('audio/')) return true;
  return false;
}

/**
 * Infer disk extension for FFmpeg demuxing. Prefer filename when trusted;
 * fall back to common MIME → ext map; default `.m4a` for generic `audio/*`.
 */
export function resolveInputExtension(filename: string, mimeType: string): string {
  const fromName = extensionFromFilename(filename);
  if (fromName) return fromName;

  const norm = mimeType.trim().toLowerCase();
  if (mimeToExt[norm]) return mimeToExt[norm];

  if (norm.startsWith('audio/')) {
    return '.m4a';
  }

  return '.m4a';
}

/** Validate a browser `File` before writing to disk or invoking FFmpeg. */
export function validateAudioUpload(file: File): ValidateAudioUploadResult {
  const parsed = uploadShape.safeParse({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (!parsed.success) {
    return { ok: false, message: 'Invalid upload payload', status: 400 };
  }

  if (parsed.data.size === 0) {
    return { ok: false, message: 'Empty file', status: 400 };
  }

  if (parsed.data.size > MAX_AUDIO_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `File exceeds maximum size of ${Math.floor(MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024))} MB`,
      status: 413,
    };
  }

  const mimeOk =
    mimeAllowed(parsed.data.type) ||
    (parsed.data.type === '' && extensionFromFilename(parsed.data.name) !== null) ||
    (parsed.data.type === 'application/octet-stream' &&
      extensionFromFilename(parsed.data.name) !== null);

  if (!mimeOk) {
    return {
      ok: false,
      message:
        'Unsupported file type. Use a Voice Memo export (.m4a), WAV, AAC, MP3, or another common audio format.',
      status: 400,
    };
  }

  return {
    ok: true,
    sizeBytes: parsed.data.size,
    mimeType: parsed.data.type || 'application/octet-stream',
    inputExtension: resolveInputExtension(parsed.data.name, parsed.data.type),
  };
}
