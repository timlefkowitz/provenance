import { NextResponse } from 'next/server';

import { requireAdminApi } from '~/lib/admin';
import { executeDenoiseFromFile } from '~/lib/audio-denoise';

export const runtime = 'nodejs';
export const maxDuration = 60;

function buildAttachmentFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const r = Math.random().toString(36).slice(2, 10);
  return `denoised-${y}-${mo}-${day}-${r}.m4a`;
}

export async function POST(request: Request) {
  console.log('[API/admin/audio/denoise] POST started');

  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Expected multipart field "file" with one audio file' }, { status: 400 });
    }

    const buffer = await executeDenoiseFromFile(file);
    const filename = buildAttachmentFilename();

    console.log('[API/admin/audio/denoise] denoise completed', { bytesOut: buffer.length });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const status = typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : undefined;
    if (status === 400 || status === 413) {
      console.error('[API/admin/audio/denoise] validation failed', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid request' },
        { status },
      );
    }

    console.error('[API/admin/audio/denoise] processing failed', err);
    return NextResponse.json({ error: 'Audio processing failed. Try a shorter clip or a different format.' }, { status: 500 });
  }
}
