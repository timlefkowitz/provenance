import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import {
  PendingClaimsClient,
  type PendingBatch,
} from './pending-claims-client';

export const metadata = {
  title: 'Pending certificate claims | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function PendingClaimsPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user?.email) {
    redirect('/auth/sign-in');
  }

  const inviteeEmail = normalizeInviteEmail(user.email);
  const adminClient = getSupabaseServerAdminClient();

  const { data: invites, error } = await (adminClient as any)
    .from('certificate_claim_invites')
    .select('id, batch_id, source_artwork_id, claim_kind, expires_at, created_at')
    .eq('invitee_email', inviteeEmail)
    .in('status', ['sent', 'pending'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Portal] pending-claims fetch failed', error);
  }

  const rows = invites ?? [];
  const sourceIds = [...new Set(rows.map((r: { source_artwork_id: string }) => r.source_artwork_id))];
  const titleBySourceId = new Map<string, string>();

  if (sourceIds.length > 0) {
    const { data: arts } = await (adminClient as any)
      .from('artworks')
      .select('id, title')
      .in('id', sourceIds);
    for (const a of arts ?? []) {
      titleBySourceId.set(a.id as string, (a.title as string) || 'Untitled');
    }
  }

  const groupMap = new Map<string, typeof rows>();
  for (const inv of rows) {
    const row = inv as { id: string; batch_id: string | null };
    const key = row.batch_id ?? row.id;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(inv);
  }

  const batches: PendingBatch[] = [];
  for (const [batchKey, groupInvites] of groupMap) {
    const first = groupInvites[0] as {
      claim_kind: string;
      expires_at: string;
    };
    const titles = groupInvites.map(
      (inv: { source_artwork_id: string }) =>
        titleBySourceId.get(inv.source_artwork_id) ?? 'Artwork',
    );
    batches.push({
      batchKey,
      claimKind: first.claim_kind,
      artworkTitles: titles,
      expiresAt: first.expires_at,
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/portal"
          className="text-sm font-serif text-wine hover:text-wine/80 underline mb-4 inline-block"
        >
          Back to Portal
        </Link>
        <h1 className="text-3xl font-display font-bold text-wine mb-2">
          Pending certificate claims
        </h1>
        <p className="text-ink/70 font-serif text-sm">
          Accept invites sent to {inviteeEmail}. You must be signed in with this email.
        </p>
      </div>

      <PendingClaimsClient batches={batches} />
    </div>
  );
}
