import Link from 'next/link';

import { requireAdmin } from '~/lib/admin';

import { AdminAudioDenoise } from './_components/admin-audio-denoise';

export const metadata = {
  title: 'Voice denoise | Admin | Provenance',
};

export const dynamic = 'force-dynamic';

export default async function AdminAudioPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-[#1793d1]/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
            <span className="text-[#67d4ff]">$</span> provenance-admin — tools
          </p>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            voice memo denoise
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-slate-500">
            Upload a recording from Voice Memos or Files. We run a speech-focused noise pass and return a
            cleaned <span className="text-slate-400">.m4a</span> for download. Nothing is stored on the server
            after the response.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 self-start rounded-sm border border-[#1793d1]/30 px-3 py-1.5 font-mono text-[12px] text-[#67d4ff] hover:bg-[#1793d1]/10"
        >
          ← overview
        </Link>
      </header>

      <AdminAudioDenoise />
    </div>
  );
}
