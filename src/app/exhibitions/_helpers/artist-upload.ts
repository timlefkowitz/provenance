/** One work a registrar uploads for an artist; `key` ties it to its `image_<key>` file. */
export type ArtistUploadItem = {
  key: string;
  title: string;
  medium: string | null;
  year: string | null;
  dimensions: string | null;
  price: string | null;
};

export const MAX_ARTIST_UPLOAD_ITEMS = 50;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

/** Parses the client's `items` JSON; drops rows without a title. */
export function parseArtistUploadItems(raw: string | null): ArtistUploadItem[] | { error: string } {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : [];
  } catch {
    return { error: 'Invalid upload data.' };
  }
  if (!Array.isArray(parsed)) return { error: 'Invalid upload data.' };

  const items = parsed
    .map((row: Record<string, unknown>) => ({
      key: cleanText(row?.key, 64) ?? '',
      title: cleanText(row?.title, 300) ?? '',
      medium: cleanText(row?.medium, 200),
      year: cleanText(row?.year, 20),
      dimensions: cleanText(row?.dimensions, 100),
      price: cleanText(row?.price, 50),
    }))
    .filter((row) => row.title.length > 0);

  if (items.length === 0) return { error: 'Add at least one artwork with a title.' };
  if (items.length > MAX_ARTIST_UPLOAD_ITEMS) {
    return { error: `Upload up to ${MAX_ARTIST_UPLOAD_ITEMS} artworks at a time.` };
  }
  return items;
}

/** Notification the artist gets when the organiser adds their works to a show. */
export function artistUploadNotificationCopy(params: {
  organiserName: string;
  exhibitionTitle: string;
  titles: string[];
  issuedCertificateOfShow: boolean;
}): { title: string; message: string } {
  const { organiserName, exhibitionTitle, titles, issuedCertificateOfShow } = params;
  const first = titles[0] ?? 'Your artwork';
  const works =
    titles.length === 1 ? `"${first}"` : `"${first}" and ${titles.length - 1} more`;
  const certificate = issuedCertificateOfShow
    ? ' and issued a Certificate of Show crediting you'
    : '';
  return {
    title:
      titles.length === 1
        ? `Added to "${exhibitionTitle}"`
        : `${titles.length} works added to "${exhibitionTitle}"`,
    message: `${organiserName} added ${works} to the exhibition "${exhibitionTitle}"${certificate}.`,
  };
}

/** artworks.creation_date is a date column: "2024" becomes 2024-01-01; anything else is dropped. */
export function yearToCreationDate(year: string | null): string | null {
  const value = year?.trim() ?? '';
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}
