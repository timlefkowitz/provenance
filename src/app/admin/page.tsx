import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { FeaturedArtworksManager } from './_components/featured-artworks-manager';
import { AdminAnalytics } from './_components/admin-analytics';
import { AdminUserAnalytics } from './_components/admin-user-analytics';
import { adminLinkTile, adminMonoLabel } from './_components/admin-dash-tokens';

export const metadata = {
  title: 'Admin | Provenance',
};

/** Avoid serving a stale shell without RSC children (analytics are admin/session-specific). */
export const dynamic = 'force-dynamic';

const TOOLS: {
  href: string;
  title: string;
  desc: string;
}[] = [
  {
    href: '/admin/feedback',
    title: 'feedback',
    desc: 'User tickets, bugs, ideas.',
  },
  {
    href: '/admin/about',
    title: 'about',
    desc: 'Public about page copy.',
  },
  {
    href: '/admin/pitch',
    title: 'pitch',
    desc: 'Markdown pitch deck.',
  },
  {
    href: '/admin/blog',
    title: 'blog',
    desc: 'SEO posts & bylines.',
  },
  {
    href: '/admin/emails',
    title: 'emails',
    desc: 'Transactional templates.',
  },
  {
    href: '/admin/users',
    title: 'users',
    desc: 'Access & subscriptions.',
  },
  {
    href: '/admin/api-keys',
    title: 'api-keys',
    desc: 'Verification API tokens.',
  },
  {
    href: '/admin/queued-artworks',
    title: 'queued',
    desc: 'Homepage feature pool.',
  },
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 border-b border-[#1793d1]/20 pb-6">
        <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
          <span className="text-[#67d4ff]">$</span> provenance-admin — dashboard
        </p>
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          overview
        </h1>
        <p className="mt-2 max-w-2xl font-mono text-sm text-slate-500">
          Analytics, presence, and tools. Online users, time on app, and newest accounts are in the
          panels below.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <AdminUserAnalytics />

        <AdminAnalytics />

        <section>
          <p className={adminMonoLabel + ' mb-3'}>modules</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOOLS.map((t) => (
              <Link key={t.href} href={t.href} className={adminLinkTile}>
                <span className="font-mono text-sm font-medium text-[#67d4ff]">{t.title}</span>
                <span className="mt-1 font-mono text-[11px] leading-snug text-slate-500">
                  {t.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <FeaturedArtworksManager />
      </div>
    </div>
  );
}
