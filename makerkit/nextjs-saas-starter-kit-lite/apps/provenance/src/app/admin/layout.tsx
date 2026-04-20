import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const isAdmin =
    user.app_metadata?.role === 'admin' ||
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes((user.email ?? '').toLowerCase());

  if (!isAdmin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-parchment font-serif">
      <header className="border-b-4 border-double border-wine bg-parchment px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-baseline gap-6">
          <span className="font-display text-2xl tracking-widest text-wine uppercase">
            PROVENANCE
          </span>
          <span className="text-sm text-ink/50 tracking-wider uppercase font-display">
            Admin
          </span>
          <nav className="ml-auto flex gap-6 text-sm tracking-wide uppercase font-display">
            <a href="/admin/artworks" className="hover:text-wine transition-colors">
              Artworks
            </a>
            <a href="/" className="hover:text-wine transition-colors text-ink/60">
              ← Site
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
