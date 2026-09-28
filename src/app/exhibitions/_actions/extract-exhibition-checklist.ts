'use server';

import OpenAI from 'openai';
import { headers } from 'next/headers';
import sharp from 'sharp';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { normalizeToJpeg } from '~/lib/artwork-storage';
import { checkRateLimit } from '~/lib/rate-limit';
import { asUntyped } from '~/lib/supabase-untyped';
import { AI_CONSENT_REQUIRED_MESSAGE, hasAiConsent } from '~/lib/ai-consent';
import {
  CHECKLIST_EXTRACTION_PROMPT,
  normalizeChecklist,
  type ExhibitionChecklist,
} from '../_helpers/checklist-parsing';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;

type ExtractResult =
  | { success: true; checklist: ExhibitionChecklist }
  | { success: false; error: string };

/** Normalises to a bounded JPEG so large phone photos and HEIC are accepted. */
async function toImageDataUrl(file: File): Promise<string | null> {
  const jpeg = await normalizeToJpeg(await file.arrayBuffer());
  if (!jpeg) return null;
  try {
    const resized = await sharp(Buffer.from(jpeg))
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch (err) {
    console.warn('[Exhibitions] extractExhibitionChecklist resize failed', err);
    return `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`;
  }
}

/**
 * Reads a photo or PDF of an exhibition checklist and returns the show title
 * plus artist / title / price / dimensions rows for the user to review.
 */
export async function extractExhibitionChecklist(formData: FormData): Promise<ExtractResult> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in.' };
  }
  if (!(await hasAiConsent(user.id))) {
    return { success: false, error: AI_CONSENT_REQUIRED_MESSAGE };
  }

  const allowed = await checkRateLimit(
    { headers: await headers() },
    { keyPrefix: `exhibition-checklist:${user.id}`, maxPerWindow: 10, windowMs: 600_000 },
  );
  if (!allowed) {
    console.warn('[Exhibitions] extractExhibitionChecklist rate limited', user.id);
    return { success: false, error: 'Too many scans. Try again in a few minutes.' };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('[Exhibitions] extractExhibitionChecklist OPENAI_API_KEY not set');
    return { success: false, error: 'Document scanning is not configured.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Choose a photo or PDF of the checklist.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: 'File is too large (max 15 MB).' };
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
  if (!isPdf && !isImage) {
    return { success: false, error: 'Unsupported file. Use a photo (JPG, PNG, HEIC) or a PDF.' };
  }

  let userContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content'];
  if (isPdf) {
    const pdfParse = (await import('pdf-parse')).default;
    let text = '';
    try {
      text = ((await pdfParse(Buffer.from(await file.arrayBuffer())))?.text ?? '').trim();
    } catch (err) {
      console.error('[Exhibitions] extractExhibitionChecklist pdf-parse failed', err);
      return { success: false, error: 'Could not read that PDF.' };
    }
    if (text.length < 10) {
      return {
        success: false,
        error: 'This PDF looks like a scan with no text. Take a photo of it instead.',
      };
    }
    userContent = text.slice(0, 30_000);
  } else {
    const dataUrl = await toImageDataUrl(file);
    if (!dataUrl) {
      return { success: false, error: 'Could not read that image. Try a JPG or PNG.' };
    }
    userContent = [
      { type: 'text', text: 'Extract the exhibition checklist from this image.' },
      { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
    ];
  }

  try {
    console.log('[Exhibitions] extractExhibitionChecklist calling OpenAI', { isPdf, bytes: file.size });
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      // Photos need stronger OCR; extracted PDF text is fine on the mini model.
      model: isPdf ? 'gpt-4o-mini' : 'gpt-4o',
      messages: [
        { role: 'system', content: CHECKLIST_EXTRACTION_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'No response from the scanner. Try again.' };
    }

    const checklist = normalizeChecklist(JSON.parse(content));
    console.log('[Exhibitions] extractExhibitionChecklist success', {
      artworks: checklist.artworks.length,
      hasTitle: Boolean(checklist.exhibitionTitle),
    });

    if (checklist.artworks.length === 0 && !checklist.exhibitionTitle) {
      return { success: false, error: "Couldn't find an exhibition list in that document." };
    }
    return { success: true, checklist };
  } catch (err) {
    console.error('[Exhibitions] extractExhibitionChecklist failed', err);
    return { success: false, error: 'Scanning failed. Try again or use a clearer photo.' };
  }
}
