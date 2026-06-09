import { LegalDocumentPage } from '~/components/legal/legal-document-page';

export const metadata = {
  title: 'Cookie Policy | Provenance',
  description: 'How Provenance Platform uses cookies and similar technologies.',
};

export default function CookiePolicyPage() {
  return <LegalDocumentPage documentId="cookies" />;
}
