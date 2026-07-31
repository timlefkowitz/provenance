import { asUntyped } from '~/lib/supabase-untyped';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import {
  SentInvitesClient,
  type SentInviteBatch,
} from './sent-invites-client';

export const metadata = {
  title: 'Sent certificate invites | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function SentInvitesPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const adminClient = getSupabaseServerAdminClient();

  const { data: invites, error } = await asUntyped(adminClient)
    .from('certificate_claim_invites')
    .select('id, batch_id, source_artwork_id, claim_kind, invitee_email, expires_at, created_at')
    .eq('created_by', user.id)
    .in('status', ['sent', 'pending'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Portal] sent-invites fetch failed', error);
  }

  const rows = invites ?? [];
  const sourceIds = [...new Set(rows.map((r: { source_artwork_id: string }) => r.source_artwork_id))];
  const titleBySourceId = new Map<string, string>();

  if (sourceIds.length > 0) {
    const { data: arts } = await asUntyped(adminClient)
      .from('artworks')
      .select('id, title')
      .in('id', sourceIds);
    for (const a of arts ?? []) {
      titleBySourceId.set(a.id as string, (a.title as string) || 'Untitled');
    }
  }

  // Group by batch_id (or individual invite id for legacy rows)
  const groupMap = new Map<string, typeof rows>();
  for (const inv of rows) {
    const row = inv as { id: string; batch_id: string | null };
    const key = row.batch_id ?? row.id;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(inv);
  }

  const batches: SentInviteBatch[] = [];
  for (const [batchKey, groupInvites] of groupMap) {
    const first = groupInvites[0] as {
      claim_kind: string;
      invitee_email: string;
      expires_at: string;
    };
    const titles = groupInvites.map(
      (inv: { source_artwork_id: string }) =>
        titleBySourceId.get(inv.source_artwork_id) ?? 'Artwork',
    );
    batches.push({
      batchKey,
      claimKind: first.claim_kind,
      inviteeEmail: first.invitee_email,
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
          Sent certificate invites
        </h1>
        <p className="text-ink/70 font-serif text-sm">
          Pending invites you have sent. You can revoke any invite that has not yet been accepted.
        </p>
      </div>

      <SentInvitesClient batches={batches} />
    </div>
  );
}
