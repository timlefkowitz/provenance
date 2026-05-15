import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import ffmpeg from 'ffmpeg-static';

import type { AudioDenoiseOptions } from './types';

function resolveFfmpegBinary(): string | null {
  const fromEnv = process.env.FFMPEG_BIN?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const vendored = path.join(process.cwd(), 'vendor', 'ffmpeg');
  if (fs.existsSync(vendored)) {
    return vendored;
  }

  const vendoredWin = path.join(process.cwd(), 'vendor', 'ffmpeg.exe');
  if (fs.existsSync(vendoredWin)) {
    return vendoredWin;
  }

  return ffmpeg ?? null;
}

/**
 * Runs FFmpeg afftdn + high-pass on an input file and writes AAC in an MP4/M4A container.
 */
export class FfmpegAudioDenoiseService {
  constructor(private readonly options: AudioDenoiseOptions = {}) {}

  async run(inputPath: string, outputPath: string): Promise<void> {
    const bin = resolveFfmpegBinary();
    if (!bin) {
      throw new Error('FFmpeg binary path unavailable (vendor/ffmpeg or ffmpeg-static)');
    }

    const hp = this.options.highpassHz ?? 100;
    const nf = this.options.afftdnNoiseFloorDb ?? -25;
    const bitrate = this.options.aacBitrate ?? '160k';
    const filter = `highpass=f=${hp},afftdn=nf=${nf}`;

    console.log('[AudioDenoise] spawning FFmpeg for denoise');

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        bin,
        ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-af', filter, '-c:a', 'aac', '-b:a', bitrate, outputPath],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        console.error('[AudioDenoise] FFmpeg spawn error', err);
        reject(err);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        const tail = stderr.trim().slice(-2000);
        reject(new Error(`FFmpeg exited with code ${code}${tail ? `: ${tail}` : ''}`));
      });
    });

    console.log('[AudioDenoise] FFmpeg finished successfully');
  }
}
