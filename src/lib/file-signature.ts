/**
 * Server-only: magic-byte file type detection and upload validation.
 *
 * Uses the `file-type` package to sniff the first few bytes of a file buffer
 * and compare against the declared MIME type.  This prevents MIME-type spoofing
 * where an attacker uploads a malicious file with a safe-looking Content-Type.
 *
 * Design choices:
 * - `fileTypeFromBuffer` is async and ESM-only in file-type ≥17. This module is
 *   Server Component / Server Action / API route safe (never bundled for the browser).
 * - We do NOT reject files whose magic bytes are unrecognised — some edge-case
 *   formats (e.g. older PDF sub-types) may not be in the file-type database.
 *   Instead we check:
 *   1. If magic bytes ARE detected, they must match an allowed type.
 *   2. If magic bytes are UNKNOWN, we fall back to the declared type check.
 *
 * Accepted MIME groups:
 *   'image'  → jpeg, png, webp, gif, heic, avif
 *   'pdf'    → application/pdf
 *   'document' → application/pdf, .docx (application/zip with docx magic)
 */

import { fileTypeFromBuffer } from 'file-type';

import { asUntyped } from '~/lib/supabase-untyped';
export type AllowedUploadGroup = 'image' | 'pdf' | 'document';

const ALLOWED_MIME_BY_GROUP: Record<AllowedUploadGroup, readonly string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'],
  pdf: ['application/pdf'],
  // DOCX is a ZIP archive; file-type reports 'application/zip' for .docx files.
  // We allow both pdf and zip (used for .docx) in the document group.
  document: [
    'application/pdf',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv',
  ],
};

export type FileSignatureResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Detect the actual file type from a buffer and assert it is allowed.
 *
 * @param buffer       Raw file bytes (ArrayBuffer, Buffer, or Uint8Array)
 * @param allowed      The upload group that determines which MIME types are permitted
 * @param declaredType The MIME type the client declared (file.type) — used as fallback
 *                     when file-type cannot identify the format
 */
export async function assertAllowedUpload(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  { allowed, declaredType }: { allowed: AllowedUploadGroup; declaredType: string },
): Promise<FileSignatureResult> {
  const allowedMimes = ALLOWED_MIME_BY_GROUP[allowed];

  try {
    const buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(
      buffer instanceof Buffer ? buffer : buffer,
    );
    const detected = await fileTypeFromBuffer(buf);

    if (detected) {
      // Magic bytes recognised — validate against the allowed list
      const detectedMime = detected.mime;
      if (!allowedMimes.includes(detectedMime)) {
        console.warn('[FileSignature] rejected upload: detected mime not allowed', {
          detected: detectedMime,
          allowed,
          declaredType,
        });
        return {
          ok: false,
          error: `File type '${detectedMime}' is not allowed. Accepted types: ${allowed}.`,
        };
      }

      // Optional: warn when declared type disagrees with detected type
      if (declaredType && declaredType !== detectedMime) {
        console.warn('[FileSignature] declared vs detected mime mismatch', {
          declared: declaredType,
          detected: detectedMime,
        });
      }

      return { ok: true };
    }

    // Magic bytes unknown — fall back to declared type
    const normalised = declaredType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!allowedMimes.includes(normalised)) {
      console.warn('[FileSignature] unknown magic bytes and declared type not allowed', {
        declaredType,
        allowed,
      });
      return {
        ok: false,
        error: `Declared file type '${declaredType}' is not allowed. Accepted types: ${allowed}.`,
      };
    }

    console.log('[FileSignature] magic bytes unknown, accepted by declared type', { declaredType });
    return { ok: true };
  } catch (err) {
    // file-type errors are non-fatal — log and allow (fail-open to avoid blocking legit uploads)
    console.error('[FileSignature] assertAllowedUpload error, failing open', err);
    return { ok: true };
  }
}

/**
 * Convenience wrapper: read a Web API `File` object's bytes and run assertAllowedUpload.
 */
export async function assertAllowedFile(
  file: File,
  allowed: AllowedUploadGroup,
): Promise<FileSignatureResult> {
  const arrayBuffer = await file.arrayBuffer();
  return assertAllowedUpload(arrayBuffer, { allowed, declaredType: file.type });
}

// ---------------------------------------------------------------------------
// VirusTotal hash-lookup (free tier AV scanning)
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hex digest of a buffer.
 * Uses the Web Crypto API, available in Node.js ≥15 and Edge runtimes.
 */
async function sha256Hex(buffer: ArrayBuffer | Buffer | Uint8Array): Promise<string> {
  let arrayBuffer: ArrayBuffer;
  if (buffer instanceof Uint8Array) {
    arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  } else if (buffer instanceof Buffer) {
    arrayBuffer = Buffer.from(buffer).buffer as ArrayBuffer;
  } else {
    arrayBuffer = buffer as ArrayBuffer;
  }
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export type VirusTotalResult =
  | { clean: true }
  | { clean: false; reason: string }
  | { skipped: true; reason: string };

/**
 * Look up a file's SHA-256 hash on VirusTotal to check for known malware.
 *
 * Uses the free VirusTotal API v3 hash-lookup endpoint — no file upload required.
 * This only catches **known** malware whose hash is in VT's database.
 * Novel or custom malware won't be detected here; magic-byte checks run first.
 *
 * Behaviour:
 * - If `VIRUSTOTAL_API_KEY` is not set, returns `{ skipped: true }` (fail-open).
 * - If VT returns 404 (unknown hash), returns `{ clean: true }` (fail-open for unknowns).
 * - If ≥3 engines flag the file as malicious, returns `{ clean: false }`.
 * - Any network/API error → fail-open and log the error.
 *
 * Rate limits on the free tier: 4 req/min, 500 req/day.
 * If you exceed them, scanning is skipped silently (fail-open).
 */
export async function vtCheckFile(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<VirusTotalResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: 'VIRUSTOTAL_API_KEY not configured' };
  }

  let hash: string;
  try {
    hash = await sha256Hex(buffer);
  } catch (err) {
    console.error('[FileSignature] vtCheckFile: SHA-256 computation failed', err);
    return { skipped: true, reason: 'hash computation error' };
  }

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
      headers: { 'x-apikey': apiKey },
      // Short timeout — don't block uploads for more than 5 seconds on VT latency.
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 404) {
      // Unknown hash — file has never been seen by VT. Fail open.
      console.log('[FileSignature] vtCheckFile: hash not found in VT, allowing upload', { hash: hash.slice(0, 16) });
      return { clean: true };
    }

    if (res.status === 429) {
      console.warn('[FileSignature] vtCheckFile: rate limited by VirusTotal, skipping scan');
      return { skipped: true, reason: 'VT rate limit' };
    }

    if (!res.ok) {
      console.warn('[FileSignature] vtCheckFile: VT API returned non-OK status', res.status);
      return { skipped: true, reason: `VT API error ${res.status}` };
    }

    const json = (await res.json()) as {
      data?: {
        attributes?: {
          last_analysis_stats?: {
            malicious?: number;
            suspicious?: number;
          };
        };
      };
    };

    const stats = json?.data?.attributes?.last_analysis_stats;
    const maliciousCount = (stats?.malicious ?? 0) + (stats?.suspicious ?? 0);

    // Conservative threshold: ≥3 engines must agree before we block an upload.
    if (maliciousCount >= 3) {
      console.warn('[FileSignature] vtCheckFile: file flagged as malicious', {
        hash: hash.slice(0, 16),
        maliciousCount,
      });
      return {
        clean: false,
        reason: `File flagged as malicious by ${maliciousCount} security vendors.`,
      };
    }

    console.log('[FileSignature] vtCheckFile: file is clean', { hash: hash.slice(0, 16), maliciousCount });
    return { clean: true };
  } catch (err) {
    // Network errors, timeouts, etc. — don't block legitimate uploads.
    console.error('[FileSignature] vtCheckFile: VT lookup failed, failing open', err);
    return { skipped: true, reason: 'VT lookup error' };
  }
}

/**
 * Run both magic-byte validation and VirusTotal hash-lookup on a File.
 * Returns the first failure found, or { ok: true } if all checks pass.
 */
export async function assertAllowedFileWithAv(
  file: File,
  allowed: AllowedUploadGroup,
): Promise<FileSignatureResult> {
  const arrayBuffer = await file.arrayBuffer();

  // 1. Magic-byte check (always runs).
  const signatureResult = await assertAllowedUpload(arrayBuffer, { allowed, declaredType: file.type });
  if (!signatureResult.ok) {
    return signatureResult;
  }

  // 2. VirusTotal hash-lookup (skipped when API key absent or on errors).
  const vtResult = await vtCheckFile(arrayBuffer);
  if ('skipped' in vtResult) {
    return { ok: true };
  }
  if (!vtResult.clean) {
    return { ok: false, error: vtResult.reason };
  }

  return { ok: true };
}
