import Link from 'next/link';
import type { LegalDocumentId } from '~/lib/legal/legal.config';
import {
  LEGAL_CONFIG,
  LEGAL_DOCUMENT_LABELS,
  LEGAL_DOCUMENT_PATHS,
} from '~/lib/legal/legal.config';
import { getLegalDocument } from '~/lib/legal/legal-documents';
import { LegalDocumentBody } from './legal-document-body';
import { SiteLegalFooter } from './site-legal-footer';

const RELATED_LEGAL_PAGES: LegalDocumentId[] = ['privacy', 'terms', 'cookies', 'billing'];

type Props = {
  documentId: LegalDocumentId;
};

export function LegalDocumentPage({ documentId }: Props) {
  const document = getLegalDocument(documentId);
  const otherPages = RELATED_LEGAL_PAGES.filter((id) => id !== documentId);

  return (
    <main className="min-h-screen bg-parchment flex flex-col">
      <div className="container mx-auto max-w-3xl px-6 py-12 md:py-16 flex-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-wine/60 font-serif mb-3">
          Legal
        </p>
        <h1 className="font-display text-3xl font-bold text-wine mb-2">
          {LEGAL_DOCUMENT_LABELS[documentId]}
        </h1>
        <p className="text-xs text-ink/45 font-serif mb-8">
          {LEGAL_CONFIG.entityName} · Last updated {LEGAL_CONFIG.lastUpdated}
        </p>
        <LegalDocumentBody document={document} />
        <nav
          className="mt-10 pt-8 border-t border-wine/10"
          aria-label="Other legal documents"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-serif mb-3">
            Related documents
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-serif">
            {otherPages.map((id) => (
              <li key={id}>
                <Link
                  href={LEGAL_DOCUMENT_PATHS[id]}
                  className="text-wine/80 hover:text-wine underline-offset-4 hover:underline"
                >
                  {LEGAL_DOCUMENT_LABELS[id]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-8 text-sm font-serif">
          <Link href="/" className="text-wine hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
      <SiteLegalFooter />
    </main>
  );
}
