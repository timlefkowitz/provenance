import { LegalDocumentPage } from '~/components/legal/legal-document-page';
import { getLegalDocumentUrl } from '~/lib/legal/legal.config';

export const metadata = {
  title: 'Privacy Policy | Provenance',
  description: 'How Provenance Platform collects, uses, and protects your personal information.',
  alternates: {
    canonical: getLegalDocumentUrl('privacy'),
  },
};

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage documentId="privacy" />;
}
