import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';

import { requireAdmin } from '~/lib/admin';

import type { AdminApiKeyRow } from './_actions/api-keys-admin';
import { AdminApiKeysPanel } from './_components/admin-api-keys-panel';

export const metadata = {
  title: 'API keys | Admin | Provenance',
};

export default async function AdminApiKeysPage() {
  const { user } = await requireAdmin();
  const client = getSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- api_keys not in generated DB types yet
  const { data: keys, error } = await (client as any)
    .from('api_keys')
    .select('id, name, scopes, planet, is_active, last_used_at, created_at, expires_at')
    .eq('account_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Admin/API keys] page list query failed', error);
  }

  const initialKeys = (keys ?? []) as AdminApiKeyRow[];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">Verification API keys</h1>
          <p className="text-ink/70 font-serif max-w-2xl">
            Create Bearer tokens for the Provenance verification API. Keys are tied to your account
            and hashed in the database. Use{' '}
            <code className="text-sm">Authorization: Bearer &lt;secret&gt;</code> on API requests.
          </p>
        </div>
        <Button asChild variant="outline" className="border-wine text-wine shrink-0">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <AdminApiKeysPanel initialKeys={initialKeys} />
    </div>
  );
}
