import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { InquiriesTable } from './_components/inquiries-table';

export const dynamic = 'force-dynamic';

export async function generateMetadata(_props: { params: Promise<{ id: string }> }) {
  return { title: 'Inquiries | Provenance' };
}

export default async function ArtworkInquiriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Verify ownership
  const { data: artwork } = await (client as any)
    .from('artworks')
    .select('id, title, artist_name, account_id, inquire_enabled, for_sale, sold_at')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();

  if (!artwork) {
    redirect('/artworks');
  }

  // Fetch inquiries via admin client to bypass RLS inconsistencies
  const admin = getSupabaseServerAdminClient();
  const { data: inquiries, error: inqErr } = await (admin as any)
    .from('artwork_inquiries')
    .select('id, name, email, message, inquiry_type, stripe_session_id, status, created_at')
    .eq('artwork_id', id)
    .eq('owner_account_id', user.id)
    .order('created_at', { ascending: false });

  if (inqErr) {
    console.error('[ArtworkInquiry] Failed to fetch inquiries', inqErr);
  }

  const rows = (inquiries ?? []) as Inquiry[];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <Link
          href={`/artworks/${id}/certificate`}
          className="text-xs uppercase tracking-widest text-wine/70 hover:text-wine transition-colors"
        >
          ← Back to certificate
        </Link>
        <h1 className="text-4xl font-display font-bold text-wine mt-4 mb-2">
          Inquiries
        </h1>
        <p className="text-ink/70 font-serif">
          {artwork.title}
          {artwork.artist_name ? ` · ${artwork.artist_name}` : ''}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-wine/20 bg-parchment/60 px-8 py-12 text-center">
          <p className="font-serif text-ink/60">No inquiries yet.</p>
          <p className="font-serif text-sm text-ink/40 mt-2">
            When visitors inquire or purchase this artwork on your creator site, their details will appear here.
          </p>
        </div>
      ) : (
        <InquiriesTable artworkId={id} initialInquiries={rows} />
      )}
    </div>
  );
}

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  message: string | null;
  inquiry_type: 'inquire' | 'purchase';
  stripe_session_id: string | null;
  status: 'pending' | 'contacted' | 'sold' | 'closed';
  created_at: string;
};
