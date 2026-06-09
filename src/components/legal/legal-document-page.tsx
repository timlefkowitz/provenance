import Link from 'next/link';
import type { LegalDocumentId } from '~/lib/legal/legal.config';
import { LEGAL_DOCUMENT_LABELS } from '~/lib/legal/legal.config';
import { getLegalDocument } from '~/lib/legal/legal-documents';
import { LegalDocumentBody } from './legal-document-body';

type Props = {
  documentId: LegalDocumentId;
};

export function LegalDocumentPage({ documentId }: Props) {
  const document = getLegalDocument(documentId);

  return (
    <main className="min-h-screen bg-parchment">
      <div className="container mx-auto max-w-3xl px-6 py-12 md:py-16">
        <p className="text-[10px] uppercase tracking-[0.25em] text-wine/60 font-serif mb-3">
          Legal
        </p>
        <h1 className="font-display text-3xl font-bold text-wine mb-8">
          {LEGAL_DOCUMENT_LABELS[documentId]}
        </h1>
        <LegalDocumentBody document={document} />
        <p className="mt-12 pt-8 border-t border-wine/10 text-sm font-serif">
          <Link href="/" className="text-wine hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
