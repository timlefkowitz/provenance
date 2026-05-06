import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';

import { listAdminContacts } from './_actions/admin-contacts';
import { AdminContactsPanel } from './_components/admin-contacts-panel';

export const metadata = {
  title: 'Contact list | Admin | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function AdminContactsPage() {
  await requireAdmin();
  const result = await listAdminContacts();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-[#1793d1]/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
            <span className="text-[#67d4ff]">$</span> provenance-admin — growth
          </p>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            contact list
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-slate-500">
            Keep a private outreach list for admins. Add rows by hand, import from{' '}
            <Link href="/admin/leads" className="text-[#67d4ff] hover:underline">
              leads
            </Link>
            , or paste a JSON array (directory / export format).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/leads"
            className="shrink-0 rounded-sm border border-[#1793d1]/30 px-3 py-1.5 font-mono text-[12px] text-[#67d4ff] hover:bg-[#1793d1]/10"
          >
            leads
          </Link>
          <Link
            href="/admin"
            className="shrink-0 rounded-sm border border-[#1793d1]/30 px-3 py-1.5 font-mono text-[12px] text-[#67d4ff] hover:bg-[#1793d1]/10"
          >
            ← overview
          </Link>
        </div>
      </header>

      {!result.ok ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300">
          {result.error}
          <span className="mt-2 block text-[11px] text-red-300/80">
            If the table is missing, apply migration{' '}
            <code className="text-[#67d4ff]/80">20260531100000_admin_contacts</code>.
          </span>
        </p>
      ) : (
        <AdminContactsPanel initialContacts={result.contacts} />
      )}
    </div>
  );
}
