/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Inserts into provenance_events (RLS: no user INSERT) via service role.
 * Used for Operations toolbox loan / consignment audit trail.
 */
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type ProvenanceEventType =
  | 'ownership_transfer'
  | 'exhibition'
  | 'loan_out'
  | 'loan_return'
  | 'consignment_active'
  | 'consignment_sold'
  | 'consignment_returned'
  | 'coa_issued'
  | 'coo_issued'
  | 'cos_issued'
  | 'authentication'
  | 'artwork_shipped'
  | 'artwork_received'
  | 'insurance_active'
  | 'insurance_expired'
  | 'artwork_accessioned';

export async function insertProvenanceEventForOperations(input: {
  artworkId: string;
  eventType: ProvenanceEventType;
  actorAccountId: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = getSupabaseServerAdminClient();
  const { error } = await (admin as any).from('provenance_events').insert({
    artwork_id: input.artworkId,
    event_type: input.eventType,
    actor_account_id: input.actorAccountId,
    event_date: new Date().toISOString(),
    metadata: {
      source: 'operations',
      ...input.metadata,
    },
  });

  if (error) {
    console.error('[Operations/provenance] insertProvenanceEventForOperations failed', error);
  }
}
