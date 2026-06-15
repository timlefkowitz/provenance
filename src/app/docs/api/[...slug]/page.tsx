import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsBreadcrumb, DocsPager } from '../_components/docs-pager';
import { DocsMarkdown } from '../_components/docs-markdown';
import { DocsToc } from '../_components/docs-toc';
import { docsPageHeader } from '../_components/docs-tokens';
import {
  getAdjacentDocs,
  getAllDocSlugs,
  getDocEntry,
} from '../_lib/docs-manifest';
import { getDoc } from '../_lib/load-doc';

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

function resolveSlug(segments: string[]): string {
  return `api/${segments.join('/')}`;
}

export async function generateStaticParams() {
  return getAllDocSlugs()
    .filter((slug) => slug.startsWith('api/'))
    .map((slug) => ({
      slug: slug.replace(/^api\//, '').split('/'),
    }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: segments } = await params;
  const slug = resolveSlug(segments);
  const entry = getDocEntry(slug);
  if (!entry) {
    return { title: 'API Reference | Provenance Docs' };
  }
  return {
    title: `${entry.title} | Provenance API`,
    description: entry.description,
  };
}

export default async function ApiDocPage({ params }: PageProps) {
  const { slug: segments } = await params;
  const slug = resolveSlug(segments);
  const entry = getDocEntry(slug);

  if (!entry || entry.group !== 'api') {
    notFound();
  }

  const doc = await getDoc(slug);
  const { prev, next } = getAdjacentDocs(slug);

  return (
    <div className="mx-auto max-w-6xl">
      <DocsBreadcrumb
        items={[
          { label: 'docs', href: '/docs' },
          { label: 'api', href: '/docs/api' },
          { label: entry.title.toLowerCase() },
        ]}
      />

      <div className="flex gap-10">
        <div className="min-w-0 flex-1">
          <header className={docsPageHeader}>
            <p className="mb-2 font-mono text-[11px] text-[#1793d1]/70">
              <span className="text-[#67d4ff]">$</span> provenance-docs — api reference
            </p>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
              {entry.title.toLowerCase()}
            </h1>
            {entry.description && (
              <p className="mt-2 max-w-2xl font-mono text-sm text-slate-500">
                {entry.description}
              </p>
            )}
          </header>

          <DocsMarkdown source={doc.content} />
          <DocsPager prev={prev} next={next} />
        </div>

        <DocsToc headings={doc.headings} />
      </div>
    </div>
  );
}
