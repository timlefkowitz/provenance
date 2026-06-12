import { LegalDocumentPage } from '~/components/legal/legal-document-page';
import { getLegalDocumentUrl } from '~/lib/legal/legal.config';

export const metadata = {
  title: 'Terms of Service | Provenance',
  description: 'Terms governing use of the Provenance Platform.',
  alternates: {
    canonical: getLegalDocumentUrl('terms'),
  },
};

export default function TermsOfServicePage() {
  return <LegalDocumentPage documentId="terms" />;
}
