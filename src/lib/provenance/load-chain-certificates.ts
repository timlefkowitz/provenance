import type { SupabaseClient } from '@supabase/supabase-js';
import { asUntyped } from '~/lib/supabase-untyped';
import { logger } from '~/lib/logger';
import { collectionOwnerName } from '~/lib/managed-collections';

/** One certificate (CoA, CoS or CoO) issued for the same work. */
export interface ChainCertificate {
  id: string;
  certificateType: string;
  certificateNumber: string | null;
  issuedAt: string | null;
  issuerName: string | null;
  isCurrent: boolean;
}

const TYPE_ORDER: Record<string, number> = { authenticity: 0, show: 1, ownership: 2, collection: 2 };

type CertRow = {
  id: string;
  certificate_type: string | null;
  certificate_number: string | number | null;
  status: string | null;
  created_at: string | null;
  account_id: string | null;
  gallery_profile_id: string | null;
};

/**
 * The certificates linked to a work (the chain from getChainArtworkIds), for the
 * Provenance section of each certificate. Drafts and voided certificates are left
 * out; the certificate being viewed is always kept and flagged `isCurrent`.
 */
export async function loadChainCertificates(
  adminClient: SupabaseClient,
  chainIds: string[],
  currentId: string,
): Promise<ChainCertificate[]> {
  if (chainIds.length === 0) return [];
  const db = asUntyped(adminClient);

  const { data, error } = await db
    .from('artworks')
    .select('id, certificate_type, certificate_number, status, created_at, account_id, gallery_profile_id')
    .in('id', chainIds);
  if (error) {
    logger.error('provenance_chain_certificates_failed', { error, currentId });
    return [];
  }

  const rows = ((data ?? []) as CertRow[]).filter((r) => r.id === currentId || r.status === 'verified');
  if (rows.length === 0) return [];

  // Issuer: the profile it was posted under (gallery / managed collection), else the account.
  const profileIds = [...new Set(rows.map((r) => r.gallery_profile_id).filter((v): v is string => !!v))];
  const accountIds = [...new Set(rows.map((r) => r.account_id).filter((v): v is string => !!v))];
  const [profilesRes, accountsRes] = await Promise.all([
    profileIds.length
      ? db.from('user_profiles').select('id, name, managed_for_name').in('id', profileIds)
      : Promise.resolve({ data: [] }),
    accountIds.length ? db.from('accounts').select('id, name').in('id', accountIds) : Promise.resolve({ data: [] }),
  ]);
  const profileName = new Map<string, string | null>(
    ((profilesRes.data ?? []) as Array<{ id: string; name: string | null; managed_for_name: string | null }>).map(
      (p) => [p.id, collectionOwnerName(p)],
    ),
  );
  const accountName = new Map<string, string | null>(
    ((accountsRes.data ?? []) as Array<{ id: string; name: string | null }>).map((a) => [a.id, a.name?.trim() || null]),
  );

  return rows
    .map((r) => ({
      id: r.id,
      certificateType: r.certificate_type || 'authenticity',
      certificateNumber: r.certificate_number != null ? String(r.certificate_number) : null,
      issuedAt: r.created_at,
      issuerName:
        (r.gallery_profile_id && profileName.get(r.gallery_profile_id)) ||
        (r.account_id && accountName.get(r.account_id)) ||
        null,
      isCurrent: r.id === currentId,
    }))
    .sort(
      (a, b) =>
        (TYPE_ORDER[a.certificateType] ?? 9) - (TYPE_ORDER[b.certificateType] ?? 9) ||
        (a.issuedAt ?? '').localeCompare(b.issuedAt ?? ''),
    );
}
