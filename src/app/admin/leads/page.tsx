import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { AdminLeadsPanel } from './_components/admin-leads-panel';

export const metadata = {
  title: 'Leads | Admin | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-[#1793d1]/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
            <span className="text-[#67d4ff]">$</span> provenance-admin — growth
          </p>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            leads
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-slate-500">
            Pull prospect rows from your Apify Actors (defaults to Google Places for venue /
            gallery discovery). Set <code className="text-slate-400">APIFY_API_TOKEN</code> and
            optionally <code className="text-slate-400">APIFY_LEADS_ACTOR_ID</code> in the
            environment.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-sm border border-[#1793d1]/30 px-3 py-1.5 font-mono text-[12px] text-[#67d4ff] hover:bg-[#1793d1]/10"
        >
          ← overview
        </Link>
      </header>

      <AdminLeadsPanel />
    </div>
  );
}
