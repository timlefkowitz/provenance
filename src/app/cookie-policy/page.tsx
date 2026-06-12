import { LegalDocumentPage } from '~/components/legal/legal-document-page';
import { getLegalDocumentUrl } from '~/lib/legal/legal.config';

export const metadata = {
  title: 'Cookie Policy | Provenance',
  description: 'How Provenance Platform uses cookies and similar technologies.',
  alternates: {
    canonical: getLegalDocumentUrl('cookies'),
  },
};

export default function CookiePolicyPage() {
  return <LegalDocumentPage documentId="cookies" />;
}
