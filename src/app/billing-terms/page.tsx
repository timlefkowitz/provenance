import { LegalDocumentPage } from '~/components/legal/legal-document-page';
import { getLegalDocumentUrl } from '~/lib/legal/legal.config';

export const metadata = {
  title: 'Billing & Refunds | Provenance',
  description: 'Subscription pricing, trials, cancellations, and refund policy for Provenance Platform.',
  alternates: {
    canonical: getLegalDocumentUrl('billing'),
  },
};

export default function BillingTermsPage() {
  return <LegalDocumentPage documentId="billing" />;
}
