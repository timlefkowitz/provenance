import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { UserAccessManager } from './_components/user-access-manager';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'User access | Admin | Provenance',
};

export default async function AdminUsersPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            User access
          </h1>
          <p className="text-ink/70 font-serif">
            Search by email and grant or revoke complimentary Toolbox access
            (no Stripe charge).
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="font-serif border-wine/30 shrink-0"
        >
          <Link href="/admin">← Admin home</Link>
        </Button>
      </div>

      <UserAccessManager />
    </div>
  );
}
