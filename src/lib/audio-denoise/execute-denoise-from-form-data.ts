import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { FfmpegAudioDenoiseService } from './ffmpeg-audio-denoise-service';
import type { AudioDenoiseOptions } from './types';
import { validateAudioUpload } from './validation';

/**
 * Validates `file`, writes to a temp dir, denoises to `.m4a`, returns output bytes.
 */
export async function executeDenoiseFromFile(
  file: File,
  options?: AudioDenoiseOptions,
): Promise<Buffer> {
  const validation = validateAudioUpload(file);
  if (!validation.ok) {
    const err = new Error(validation.message) as Error & { status?: number };
    err.status = validation.status;
    throw err;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-audio-'));
  const inPath = path.join(tmpDir, `input${validation.inputExtension}`);
  const outPath = path.join(tmpDir, 'output.m4a');

  console.log('[AudioDenoise] processing upload', {
    sizeBytes: validation.sizeBytes,
    ext: validation.inputExtension,
  });

  try {
    const inputBuf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inPath, inputBuf);

    const service = new FfmpegAudioDenoiseService(options);
    await service.run(inPath, outPath);

    return await fs.readFile(outPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
