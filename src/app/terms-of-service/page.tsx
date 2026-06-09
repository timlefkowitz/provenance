import { LegalDocumentPage } from '~/components/legal/legal-document-page';

export const metadata = {
  title: 'Terms of Service | Provenance',
  description: 'Terms governing use of the Provenance Platform.',
};

export default function TermsOfServicePage() {
  return <LegalDocumentPage documentId="terms" />;
}
