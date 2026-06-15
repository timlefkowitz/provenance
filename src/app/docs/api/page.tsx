import Link from 'next/link';
import { PLANETS, PLANET_CONFIGS } from '@provenance/core/types';
import { docHref, getDocsByGroup } from '../_lib/docs-manifest';
import {
  docsLinkTile,
  docsMethodGet,
  docsMethodPost,
  docsMonoLabel,
  docsPageHeader,
  docsPanel,
} from '../_components/docs-tokens';

const ENDPOINTS = [
  { method: 'POST', slug: 'api/verify', path: '/api/v1/verify', desc: 'Verify an asset' },
  {
    method: 'GET',
    slug: 'api/get-asset',
    path: '/api/v1/assets/{planet}/{id}',
    desc: 'Get asset details',
  },
  {
    method: 'GET',
    slug: 'api/asset-history',
    path: '/api/v1/assets/{planet}/{id}/history',
    desc: 'Asset event history',
  },
  {
    method: 'POST',
    slug: 'api/create-asset',
    path: '/api/v1/assets/{planet}',
    desc: 'Create an asset',
  },
  {
    method: 'GET',
    slug: 'api/certificates',
    path: '/api/v1/certificates/{number}',
    desc: 'Look up certificate',
  },
  {
    method: 'POST',
    slug: 'api/webhooks',
    path: '/api/v1/webhooks',
    desc: 'Register webhook',
  },
] as const;

export const metadata = {
  title: 'API Reference | Provenance Docs',
  description: 'Verification API for asset authentication across Provenance planets.',
};

export default function ApiDocsLandingPage() {
  const apiEntries = getDocsByGroup('api');

  return (
    <div className="mx-auto max-w-6xl">
      <header className={docsPageHeader}>
        <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
          <span className="text-[#67d4ff]">$</span> provenance-docs — api reference
        </p>
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          verification api
        </h1>
        <p className="mt-2 max-w-2xl font-mono text-sm text-slate-500">
          Unified asset verification across Provenance planets. All endpoints require a Bearer
          token issued from the main app.
        </p>
      </header>

      <section className="mb-10">
        <p className={docsMonoLabel + ' mb-3'}>base url</p>
        <div className={'rounded-sm border border-[#1793d1]/25 bg-[#0a0c10] p-4 font-mono text-sm text-[#67d4ff]'}>
          https://api.provenance.guru
        </div>
        <p className="mt-2 font-mono text-[11px] text-slate-600">
          Local development: <code className="text-slate-400">http://localhost:3100</code>
        </p>
      </section>

      <section className="mb-10">
        <p className={docsMonoLabel + ' mb-3'}>planets</p>
        <div className={'overflow-x-auto ' + docsPanel}>
          <table className="w-full min-w-[560px] border-collapse font-mono text-[13px]">
            <thead>
              <tr className="border-b border-[#1793d1]/15 text-left text-[11px] uppercase tracking-wide text-[#1793d1]/70">
                <th className="px-4 py-2 font-medium">Planet</th>
                <th className="px-4 py-2 font-medium">Subdomain</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1793d1]/10">
              {PLANETS.map((id) => {
                const config = PLANET_CONFIGS[id];
                return (
                  <tr key={id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-[#67d4ff]">{config.label}</td>
                    <td className="px-4 py-2 text-slate-500">{config.subdomain}</td>
                    <td className="px-4 py-2 text-slate-400">{config.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <p className={docsMonoLabel + ' mb-3'}>endpoints</p>
        <div className="space-y-2">
          {ENDPOINTS.map((ep) => (
            <Link
              key={ep.slug}
              href={docHref(ep.slug)}
              className="group flex flex-wrap items-center gap-3 rounded-sm border border-[#1793d1]/20 bg-[#12151c] px-4 py-3 transition-colors hover:border-[#1793d1]/40 hover:bg-[#161c26]"
            >
              <span className={ep.method === 'GET' ? docsMethodGet : docsMethodPost}>
                {ep.method}
              </span>
              <code className="font-mono text-[13px] text-slate-300">{ep.path}</code>
              <span className="font-mono text-[11px] text-slate-500 group-hover:text-slate-400">
                {ep.desc}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <p className={docsMonoLabel + ' mb-3'}>guides</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apiEntries.map((entry) => (
            <Link key={entry.slug} href={docHref(entry.slug)} className={docsLinkTile}>
              <span className="font-mono text-sm font-medium text-[#67d4ff]">
                {entry.title.toLowerCase()}
              </span>
              <span className="mt-1 font-mono text-[11px] leading-snug text-slate-500">
                {entry.description}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
