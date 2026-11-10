import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getProfileHandoffPreview } from '~/lib/profile-handoff/handoff';
import { AcceptProfileHandoffClient } from './accept-profile-handoff-client';

export const metadata = {
  title: 'Accept your invite | Provenance',
};

export default async function ClaimProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  const trimmed = token.trim();
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  const preview = trimmed
    ? await getProfileHandoffPreview(trimmed, user ? { id: user.id, email: user.email } : null)
    : { ok: false as const, error: 'Open the link from your invitation email.' };

  return (
    <AcceptProfileHandoffClient
      token={trimmed}
      preview={preview}
      signedInEmail={user?.email ?? null}
    />
  );
}
