'use server';

import OpenAI from 'openai';
import type { ArtistCvJson } from '~/lib/grants';

const CV_EXTRACTION_SCHEMA = `
Extract structured data from this artist CV/resume. Return a single JSON object with these exact keys (use null or empty array where not found):
- location: string | null (city, region, or country mentioned)
- education: array of { institution: string, degree: string, year: string }
- exhibitions: array of { name: string, venue: string, year: string }
- medium: string | null (e.g. painting, sculpture)
- disciplines: array of strings (art disciplines/categories)
- summary: string | null (brief professional summary)
`;

/**
 * Extract structured JSON from raw CV/resume text using OpenAI.
 * Call from server only; requires OPENAI_API_KEY.
 */
export async function extractCvToJson(cvText: string): Promise<{ data: ArtistCvJson | null; error: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[Grants] extractCvToJson OPENAI_API_KEY not set');
    return { data: null, error: 'OpenAI API key not configured' };
  }

  const text = cvText.trim();
  if (!text.length) {
    return { data: null, error: 'No text to extract' };
  }

  try {
    console.log('[Grants] extractCvToJson calling OpenAI');
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CV_EXTRACTION_SCHEMA + '\nRespond with only valid JSON, no markdown.' },
        { role: 'user', content: text.slice(0, 12000) }, // stay within context
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { data: null, error: 'No response from OpenAI' };
    }

    const data = JSON.parse(content) as ArtistCvJson;
    console.log('[Grants] extractCvToJson success');
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract CV';
    console.error('[Grants] extractCvToJson', err);
    return { data: null, error: message };
  }
}
