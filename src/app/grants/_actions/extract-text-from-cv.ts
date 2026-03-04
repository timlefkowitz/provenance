'use server';

/**
 * Extract plain text from CV file buffer by type.
 * Supports PDF, DOCX, and TXT.
 */
export async function extractTextFromCvBuffer(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<{ text: string; error: string | null }> {
  try {
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      console.log('[Grants] extractTextFromCvBuffer plain text');
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(buffer);
      return { text: text.trim(), error: null };
    }

    if (mimeType === 'application/pdf') {
      console.log('[Grants] extractTextFromCvBuffer PDF');
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(Buffer.from(buffer));
      return { text: (data?.text || '').trim(), error: null };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      console.log('[Grants] extractTextFromCvBuffer DOCX');
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      return { text: (result?.value || '').trim(), error: null };
    }

    return { text: '', error: 'Unsupported file type. Use PDF, Word (DOCX), or plain text.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract text from file';
    console.error('[Grants] extractTextFromCvBuffer', err);
    return { text: '', error: message };
  }
}
