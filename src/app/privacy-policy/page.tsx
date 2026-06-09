import { LegalDocumentPage } from '~/components/legal/legal-document-page';

export const metadata = {
  title: 'Privacy Policy | Provenance',
  description: 'How Provenance Platform collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage documentId="privacy" />;
}
