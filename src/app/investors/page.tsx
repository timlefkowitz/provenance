import Link from 'next/link';

export const metadata = {
  title: 'Investor materials | Provenance',
  description: 'Provenance seed round — one-pager and confidential memo.',
};

const DOCS = [
  { slug: 'one-pager', title: 'Seed round one-pager', description: 'Summary: what we do, traction, pricing, round terms, team.' },
  { slug: 'confidential-memo', title: 'Confidential investment memorandum', description: 'Full memo with cap table, projections, and terms.' },
] as const;

export default function InvestorsPage() {
  return (
    <main className="min-h-screen p-8 sm:p-12 font-serif max-w-2xl mx-auto">
      <div className="border-b border-wine/30 pb-6 mb-8">
        <h1 className="font-display text-2xl sm:text-3xl tracking-wide text-wine">
          Investor materials
        </h1>
        <p className="mt-2 font-body text-ink/80">
          Link-only page — not linked from the main site. Share these links with qualified investors.
        </p>
      </div>
      <ul className="space-y-4">
        {DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/investors/${doc.slug}`}
              className="block p-4 border border-wine/30 hover:border-wine hover:bg-wine/5 transition-colors"
            >
              <span className="font-display text-lg text-wine">{doc.title}</span>
              <p className="mt-1 font-body text-sm text-ink/70">{doc.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
