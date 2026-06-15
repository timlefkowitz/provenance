import Link from 'next/link';
import {
  DOC_SECTIONS,
  docHref,
  getDocsByGroup,
} from './_lib/docs-manifest';
import { docsLinkTile, docsMonoLabel, docsPageHeader } from './_components/docs-tokens';

export default function DocsHomePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className={docsPageHeader}>
        <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
          <span className="text-[#67d4ff]">$</span> provenance-docs — getting-started
        </p>
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          documentation
        </h1>
        <p className="mt-2 max-w-2xl font-mono text-sm text-slate-500">
          Learn how to use Provenance — from artworks and certificates to exhibitions,
          grants, and CRM. Developers can integrate via the Verification API.
        </p>
      </header>

      {DOC_SECTIONS.map((section) => {
        const entries = getDocsByGroup(section.id);
        return (
          <section key={section.id} className="mb-10">
            <p className={docsMonoLabel + ' mb-3'}>{section.label}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
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
        );
      })}
    </div>
  );
}
