'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { LegalDocumentId } from '~/lib/legal/legal.config';
import { getLegalDocument } from '~/lib/legal/legal-documents';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { LegalDocumentBody } from './legal-document-body';

type LegalModalContextValue = {
  openLegalDocument: (id: LegalDocumentId) => void;
  closeLegalDocument: () => void;
};

const LegalModalContext = createContext<LegalModalContextValue | null>(null);

export function LegalModalProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<LegalDocumentId | null>(null);

  const openLegalDocument = useCallback((id: LegalDocumentId) => {
    console.log('[Legal] openLegalDocument', { id });
    setOpenId(id);
  }, []);

  const closeLegalDocument = useCallback(() => {
    setOpenId(null);
  }, []);

  const document = openId ? getLegalDocument(openId) : null;

  return (
    <LegalModalContext.Provider value={{ openLegalDocument, closeLegalDocument }}>
      {children}
      <Dialog open={openId !== null} onOpenChange={(open) => !open && closeLegalDocument()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto font-serif">
          {document && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-wine pr-8">
                  {document.title}
                </DialogTitle>
              </DialogHeader>
              <LegalDocumentBody document={document} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </LegalModalContext.Provider>
  );
}

export function useLegalModal(): LegalModalContextValue {
  const ctx = useContext(LegalModalContext);
  if (!ctx) {
    throw new Error('useLegalModal must be used within LegalModalProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside provider (returns no-op). */
export function useLegalModalOptional(): LegalModalContextValue | null {
  return useContext(LegalModalContext);
}
