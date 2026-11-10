import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { requireAdmin } from '~/lib/admin';

import { listInstitutionInvites, listInstitutionOptions } from './_actions/institution-invites';
import { InstitutionInvitesManager } from './_components/institution-invites-manager';

export const metadata = {
  title: 'Institution invites | Admin | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function AdminInstitutionsPage() {
  await requireAdmin();

  const [institutions, invites] = await Promise.all([
    listInstitutionOptions(),
    listInstitutionInvites(),
  ]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 font-display text-4xl font-bold text-wine">Institution invites</h1>
          <p className="font-serif text-ink/70">
            Invite a museum or institution&apos;s team with a free trial. Everyone gets their own
            email and link. Accepting adds them to the institution&apos;s team and keeps a new
            account in institution mode.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 border-wine/30 font-serif">
          <Link href="/admin">← Admin home</Link>
        </Button>
      </div>

      <InstitutionInvitesManager
        institutions={institutions.ok ? institutions.institutions : []}
        invites={invites.ok ? invites.invites : []}
        loadError={!institutions.ok ? institutions.error : !invites.ok ? invites.error : null}
      />
    </div>
  );
}
