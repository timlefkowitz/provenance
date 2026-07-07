/**
 * OpenAI sub-calls for Taco's AI writing tools.
 * All functions return generated text strings, never throw — they return an
 * error string on failure so the caller can surface it gracefully.
 */

import OpenAI from 'openai';
import type { ArtistCvJson } from '~/lib/grants';

const MODEL = 'gpt-4o-mini';

function getClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

/* -------------------------------------------------------------------------- */
/*  Artist statement                                                          */
/* -------------------------------------------------------------------------- */

export async function generateArtistStatement(
  apiKey: string,
  opts: {
    name: string | null;
    medium: string | null;
    bio: string | null;
    cvJson: ArtistCvJson | null;
    focus: string | null;
  },
): Promise<{ text: string; error: string | null }> {
  console.log('[TacoWriting] generateArtistStatement', { focus: opts.focus });

  const cvSummary = buildCvSummary(opts.cvJson);
  const focusLine = opts.focus ? `Focus or emphasis for this statement: ${opts.focus}.` : '';

  const prompt = `Write a compelling 300-word artist statement for ${opts.name ?? 'this artist'}.
Medium/discipline: ${opts.medium ?? 'not specified'}.
${opts.bio ? `Existing bio: ${opts.bio}` : ''}
${cvSummary ? `CV highlights: ${cvSummary}` : ''}
${focusLine}

Write in the first person. Be specific and avoid clichés. Focus on process, intent, and ideas — not just materials. Return only the statement text, no headings or preamble.`;

  try {
    const openai = getClient(apiKey);
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are an experienced art writer helping artists articulate their practice.' },
        { role: 'user', content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    if (!text) return { text: '', error: 'No response from OpenAI' };
    console.log('[TacoWriting] generateArtistStatement done', text.length, 'chars');
    return { text, error: null };
  } catch (err) {
    console.error('[TacoWriting] generateArtistStatement failed', err);
    return { text: '', error: err instanceof Error ? err.message : 'Generation failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Exhibition text                                                           */
/* -------------------------------------------------------------------------- */

export async function generateExhibitionText(
  apiKey: string,
  opts: {
    exhibitionTitle: string;
    description: string | null;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    artworkTitles: string[];
    artistNames: string[];
    format: 'press_release' | 'wall_text' | 'catalogue_note';
  },
): Promise<{ text: string; error: string | null }> {
  console.log('[TacoWriting] generateExhibitionText', { format: opts.format, exhibition: opts.exhibitionTitle });

  const artworkList = opts.artworkTitles.length
    ? `Works included: ${opts.artworkTitles.slice(0, 15).join(', ')}.`
    : '';
  const artistList = opts.artistNames.length
    ? `Artists: ${opts.artistNames.slice(0, 10).join(', ')}.`
    : '';
  const dateRange = [opts.startDate, opts.endDate].filter(Boolean).join(' – ');

  const formatInstructions: Record<string, string> = {
    press_release: 'Write a 250-word press release with a dateline, lead paragraph, exhibition details, and boilerplate. Use AP style.',
    wall_text: 'Write 150-word interpretive wall text suitable for gallery visitors. Accessible, engaging, jargon-light.',
    catalogue_note: 'Write a 200-word scholarly catalogue essay note contextualizing the exhibition within art history.',
  };

  const prompt = `${formatInstructions[opts.format] ?? formatInstructions.press_release}

Exhibition: "${opts.exhibitionTitle}"
${dateRange ? `Dates: ${dateRange}` : ''}
${opts.location ? `Venue: ${opts.location}` : ''}
${opts.description ? `Description: ${opts.description}` : ''}
${artworkList}
${artistList}

Return only the text, no headings or preamble.`;

  try {
    const openai = getClient(apiKey);
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a professional art writer and publicist.' },
        { role: 'user', content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    if (!text) return { text: '', error: 'No response from OpenAI' };
    console.log('[TacoWriting] generateExhibitionText done', text.length, 'chars');
    return { text, error: null };
  } catch (err) {
    console.error('[TacoWriting] generateExhibitionText failed', err);
    return { text: '', error: err instanceof Error ? err.message : 'Generation failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Open call submission statement                                            */
/* -------------------------------------------------------------------------- */

export async function generateOpenCallSubmission(
  apiKey: string,
  opts: {
    openCallTitle: string;
    openCallDescription: string | null;
    artistName: string | null;
    medium: string | null;
    bio: string | null;
    cvJson: ArtistCvJson | null;
  },
): Promise<{ text: string; error: string | null }> {
  console.log('[TacoWriting] generateOpenCallSubmission', { openCall: opts.openCallTitle });

  const cvSummary = buildCvSummary(opts.cvJson);

  const prompt = `Write a 200-word artist submission statement for the following open call. Tailor it specifically to the call's focus and requirements.

Open call: "${opts.openCallTitle}"
${opts.openCallDescription ? `Call description: ${opts.openCallDescription}` : ''}

Artist: ${opts.artistName ?? 'the artist'}
Medium: ${opts.medium ?? 'not specified'}
${opts.bio ? `Bio: ${opts.bio}` : ''}
${cvSummary ? `CV highlights: ${cvSummary}` : ''}

Write in the first person. Be specific to this call. Return only the statement text.`;

  try {
    const openai = getClient(apiKey);
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are an experienced grant writer helping artists submit compelling applications.' },
        { role: 'user', content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    if (!text) return { text: '', error: 'No response from OpenAI' };
    console.log('[TacoWriting] generateOpenCallSubmission done', text.length, 'chars');
    return { text, error: null };
  } catch (err) {
    console.error('[TacoWriting] generateOpenCallSubmission failed', err);
    return { text: '', error: err instanceof Error ? err.message : 'Generation failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Collector outreach email                                                  */
/* -------------------------------------------------------------------------- */

export async function generateCollectorOutreach(
  apiKey: string,
  opts: {
    contactName: string;
    artistName: string | null;
    context: string | null;
    notes: string | null;
    stage: string | null;
  },
): Promise<{ text: string; error: string | null }> {
  console.log('[TacoWriting] generateCollectorOutreach', { contact: opts.contactName });

  const prompt = `Write a short, warm, personal outreach email from artist ${opts.artistName ?? 'the artist'} to collector ${opts.contactName}.
${opts.context ? `Context / purpose: ${opts.context}` : ''}
${opts.notes ? `Notes about this contact: ${opts.notes}` : ''}
${opts.stage ? `Relationship stage: ${opts.stage}` : ''}

Keep it under 150 words. Conversational, not salesy. Include a subject line at the top formatted as "Subject: …". Return only the email (subject + body).`;

  try {
    const openai = getClient(apiKey);
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are an artist helping draft personalized collector outreach.' },
        { role: 'user', content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    if (!text) return { text: '', error: 'No response from OpenAI' };
    console.log('[TacoWriting] generateCollectorOutreach done', text.length, 'chars');
    return { text, error: null };
  } catch (err) {
    console.error('[TacoWriting] generateCollectorOutreach failed', err);
    return { text: '', error: err instanceof Error ? err.message : 'Generation failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Website bio                                                               */
/* -------------------------------------------------------------------------- */

export async function generateWebsiteBio(
  apiKey: string,
  opts: {
    name: string | null;
    medium: string | null;
    location: string | null;
    bio: string | null;
    cvJson: ArtistCvJson | null;
    length: 'short' | 'medium';
  },
): Promise<{ text: string; error: string | null }> {
  console.log('[TacoWriting] generateWebsiteBio', { length: opts.length });

  const cvSummary = buildCvSummary(opts.cvJson);
  const wordCount = opts.length === 'medium' ? 250 : 100;

  const prompt = `Write a ${wordCount}-word website bio for artist ${opts.name ?? 'this artist'}.
Medium: ${opts.medium ?? 'not specified'}
${opts.location ? `Location: ${opts.location}` : ''}
${opts.bio ? `Existing bio for reference: ${opts.bio}` : ''}
${cvSummary ? `CV highlights: ${cvSummary}` : ''}

Write in the third person. Engaging, contemporary, not stuffy. Suitable for a website About page. Return only the bio text.`;

  try {
    const openai = getClient(apiKey);
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a professional art writer specializing in artist bios for websites.' },
        { role: 'user', content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    if (!text) return { text: '', error: 'No response from OpenAI' };
    console.log('[TacoWriting] generateWebsiteBio done', text.length, 'chars');
    return { text, error: null };
  } catch (err) {
    console.error('[TacoWriting] generateWebsiteBio failed', err);
    return { text: '', error: err instanceof Error ? err.message : 'Generation failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Practice summary (internal — for Taco replies)                           */
/* -------------------------------------------------------------------------- */

export async function generatePracticeSummary(
  apiKey: string,
  opts: {
    name: string | null;
    medium: string | null;
    bio: string | null;
    cvJson: ArtistCvJson | null;
    artworkCount: number;
    exhibitionCount: number;
    hasSoldWork: string | null;
  },
): Promise<{ text: string; error: string | null }> {
  console.log('[TacoWriting] generatePracticeSummary');

  const cvSummary = buildCvSummary(opts.cvJson);

  const prompt = `Write a concise 2-paragraph summary of this artist's practice for use in a studio assistant reply.

Artist: ${opts.name ?? 'unknown'}
Medium: ${opts.medium ?? 'not specified'}
${opts.bio ? `Bio: ${opts.bio}` : ''}
${cvSummary ? `CV highlights: ${cvSummary}` : ''}
Artworks documented: ${opts.artworkCount}
Exhibitions: ${opts.exhibitionCount}
${opts.hasSoldWork ? `Sales history: ${opts.hasSoldWork}` : ''}

Write in the third person. First paragraph: practice and medium. Second paragraph: career highlights and trajectory. Be specific, avoid clichés. Return only the two paragraphs.`;

  try {
    const openai = getClient(apiKey);
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are an art critic and studio assistant summarizing an artist\'s practice.' },
        { role: 'user', content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    if (!text) return { text: '', error: 'No response from OpenAI' };
    return { text, error: null };
  } catch (err) {
    console.error('[TacoWriting] generatePracticeSummary failed', err);
    return { text: '', error: err instanceof Error ? err.message : 'Generation failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal helper                                                           */
/* -------------------------------------------------------------------------- */

function buildCvSummary(cvJson: ArtistCvJson | null): string {
  if (!cvJson) return '';
  const parts: string[] = [];
  if (cvJson.summary) parts.push(cvJson.summary);
  if (Array.isArray(cvJson.exhibitions) && cvJson.exhibitions.length) {
    const recent = cvJson.exhibitions.slice(0, 3).map((e) => `${e.name ?? ''} (${e.year ?? ''})`).join(', ');
    parts.push(`Recent exhibitions: ${recent}`);
  }
  if (Array.isArray(cvJson.education) && cvJson.education.length) {
    const edu = cvJson.education.slice(0, 2).map((e) => `${e.degree ?? ''} ${e.institution ?? ''}`).join(', ');
    parts.push(`Education: ${edu}`);
  }
  if (Array.isArray(cvJson.disciplines) && cvJson.disciplines.length) {
    parts.push(`Disciplines: ${cvJson.disciplines.join(', ')}`);
  }
  return parts.join('. ');
}
