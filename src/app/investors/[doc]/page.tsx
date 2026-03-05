import { readFile } from 'fs/promises';
import path from 'path';
import { notFound } from 'next/navigation';
import { MarkdownViewer } from '../_components/markdown-viewer';

const DOC_MAP: Record<string, string> = {
  'one-pager': 'investor-one-pager.md',
  'confidential-memo': 'investor-confidential-memo.md',
  'monthly-expenses': 'investor-monthly-expenses.md',
};

const DOC_TITLES: Record<string, string> = {
  'one-pager': 'Seed round one-pager',
  'confidential-memo': 'Confidential investment memorandum',
  'monthly-expenses': 'Monthly expenses',
};

type PageProps = { params: Promise<{ doc: string }> };

export async function generateStaticParams() {
  return Object.keys(DOC_MAP).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps) {
  const { doc } = await params;
  const title = DOC_TITLES[doc];
  if (!title) return { title: 'Investor materials | Provenance' };
  return { title: `${title} | Provenance`, description: 'Provenance investor materials.' };
}

export default async function InvestorDocPage({ params }: PageProps) {
  const { doc } = await params;
  const filename = DOC_MAP[doc];
  if (!filename) notFound();

  let content: string;
  try {
    const docsDir = path.join(process.cwd(), 'docs');
    const filePath = path.join(docsDir, filename);
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    console.error('[Investors] Failed to read doc', { doc, filename }, err);
    notFound();
  }

  return (
    <main className="p-6 sm:p-10 font-serif max-w-3xl mx-auto">
      <MarkdownViewer content={content} />
    </main>
  );
}
