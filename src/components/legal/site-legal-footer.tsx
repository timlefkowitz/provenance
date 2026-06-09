'use client';

import Link from 'next/link';
import { LEGAL_CONFIG, LEGAL_DOCUMENT_LABELS, type LegalDocumentId } from '~/lib/legal/legal.config';
import { useLegalModal } from './legal-modal-context';

const STANDARD_LINKS: LegalDocumentId[] = ['privacy', 'cookies', 'terms'];
const SUBSCRIPTION_LINKS: LegalDocumentId[] = ['privacy', 'cookies', 'terms', 'billing'];

type Props = {
  variant?: 'standard' | 'subscription';
  className?: string;
};

export function SiteLegalFooter({ variant = 'standard', className }: Props) {
  const { openLegalDocument } = useLegalModal();
  const links = variant === 'subscription' ? SUBSCRIPTION_LINKS : STANDARD_LINKS;

  return (
    <footer
      className={`border-t border-wine/10 px-6 py-10 text-center text-sm text-ink/50 sm:px-10 ${className ?? ''}`}
    >
      <p className="font-serif mb-4">
        © {new Date().getFullYear()} {LEGAL_CONFIG.entityName}.
      </p>
      <nav
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.2em] font-serif"
        aria-label="Legal"
      >
        {links.map((id, i) => (
          <span key={id} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-ink/25" aria-hidden>·</span>}
            <button
              type="button"
              onClick={() => openLegalDocument(id)}
              className="text-wine/70 hover:text-wine transition-colors underline-offset-4 hover:underline"
            >
              {LEGAL_DOCUMENT_LABELS[id]}
            </button>
          </span>
        ))}
      </nav>
      <p className="mt-4 text-xs text-ink/40 font-serif">
        <Link href="/" className="text-wine/60 hover:text-wine/80 underline-offset-4 hover:underline">
          Home
        </Link>
      </p>
    </footer>
  );
}
