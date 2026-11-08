import { CERTIFICATE_TYPES, USER_ROLES } from '~/lib/user-roles';

/**
 * Whether selecting a work into a show issues the show's Certificate of Show:
 * only for an artist's Certificate of Authenticity held by someone other than
 * the show's organiser, in a gallery, institution or curator show.
 */
export function shouldIssueExhibitionCos(params: {
  ownerRole: string | null | undefined;
  ownerAccountId: string;
  certificateType: string | null | undefined;
  holderAccountId: string | null | undefined;
}): boolean {
  if (params.ownerRole === USER_ROLES.COLLECTOR) return false;
  if ((params.certificateType ?? CERTIFICATE_TYPES.AUTHENTICITY) !== CERTIFICATE_TYPES.AUTHENTICITY) {
    return false;
  }
  if (!params.holderAccountId) return false;
  return params.holderAccountId !== params.ownerAccountId;
}

type CosForApproval = {
  account_id: string | null;
  certificate_type: string | null;
  artist_account_id: string | null;
};

/**
 * The artist whose approval a change to this Certificate of Show needs: the
 * artist behind the CoA it was issued from, when that isn't the holder.
 * Null for every other certificate.
 */
export function cosApprovingArtistId(artwork: CosForApproval): string | null {
  if (artwork.certificate_type !== CERTIFICATE_TYPES.SHOW) return null;
  if (!artwork.artist_account_id) return null;
  if (artwork.artist_account_id === artwork.account_id) return null;
  return artwork.artist_account_id;
}

/**
 * Who reviews a change request on a certificate. A change the COS holder's
 * side (holder or gallery team) proposes goes to the artist; anything else
 * goes to the holder, as for every certificate.
 */
export function resolveRequestReviewer(params: {
  artwork: CosForApproval;
  requestedBy: string;
  requesterCanEditCertificate: boolean;
}): string | null {
  const artist = cosApprovingArtistId(params.artwork);
  if (artist && params.requestedBy !== artist && params.requesterCanEditCertificate) {
    return artist;
  }
  return params.artwork.account_id;
}

/**
 * Certificate content the artist approves on a Certificate of Show, keyed by
 * updateProvenance's field name, with the change-request (column) name.
 * Everything else (visibility, sold, order, exhibition link) stays the
 * holder's to change directly.
 */
const COS_CONTENT_FIELDS: Record<string, string> = {
  title: 'title',
  description: 'description',
  artist_name: 'artist_name',
  medium: 'medium',
  creationDate: 'creation_date',
  dimensions: 'dimensions',
  formerOwners: 'former_owners',
  auctionHistory: 'auction_history',
  exhibitionHistory: 'exhibition_history',
  historicContext: 'historic_context',
  celebrityNotes: 'celebrity_notes',
  value: 'value',
  edition: 'edition',
  productionLocation: 'production_location',
  ownedBy: 'owned_by',
  soldBy: 'sold_by',
};

function normalizeForCompare(column: string, value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return column === 'creation_date' ? text.slice(0, 10) : text;
}

/**
 * Splits an updateProvenance payload for a COS that needs the artist's
 * approval: changed content goes into a change request (column names), the
 * rest is applied directly. Unchanged content fields are dropped.
 */
export function splitCosContentChanges<T extends Record<string, unknown>>(
  provenance: T,
  current: Record<string, unknown>,
): { requestFields: Record<string, string>; remaining: Partial<T> } {
  const requestFields: Record<string, string> = {};
  const remaining: Partial<T> = {};
  for (const [key, value] of Object.entries(provenance)) {
    if (value === undefined) continue;
    const column = COS_CONTENT_FIELDS[key];
    if (!column) {
      (remaining as Record<string, unknown>)[key] = value;
      continue;
    }
    if (normalizeForCompare(column, value) !== normalizeForCompare(column, current[column])) {
      requestFields[column] = value === null ? '' : String(value);
    }
  }
  return { requestFields, remaining };
}
