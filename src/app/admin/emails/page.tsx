import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { Button } from '@kit/ui/button';
import { getEmailTemplatesAdminData } from './_actions/email-templates-admin';
import { EditEmailTemplatesForm } from './_components/edit-email-templates-form';

export const metadata = {
  title: 'Email templates | Admin | Provenance',
};

export default async function AdminEmailsPage() {
  await requireAdmin();
  const initial = await getEmailTemplatesAdminData();

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            Email templates
          </h1>
          <p className="text-ink/70 font-serif">
            Edit transactional email copy (Markdown) and global colors. Requires the{' '}
            <code className="text-sm">email_settings</code> and{' '}
            <code className="text-sm">email_templates</code> migration applied in Supabase.
          </p>
        </div>
        <Button asChild variant="outline" className="border-wine text-wine">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <EditEmailTemplatesForm initial={initial} />
    </div>
  );
}
