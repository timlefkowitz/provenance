import Link from 'next/link';

import { requireAdmin } from '~/lib/admin';

import { BrochureStudio } from './_components/brochure-studio';

export const metadata = {
  title: 'Brochure | Admin | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function AdminBrochurePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-[#1793d1]/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
            <span className="text-[#67d4ff]">$</span> provenance-admin — sales
          </p>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            gallery &amp; museum brochure
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-slate-500">
            An 8-page booklet on two Letter sheets. Print double-sided, flip on the short edge, fold the stack
            and staple the fold. The copy lives in src/app/admin/brochure/_content.ts.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 self-start rounded-sm border border-[#1793d1]/30 px-3 py-1.5 font-mono text-[12px] text-[#67d4ff] hover:bg-[#1793d1]/10"
        >
          ← overview
        </Link>
      </header>

      <BrochureStudio />
    </div>
  );
}
