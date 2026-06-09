import { LegalDocumentPage } from '~/components/legal/legal-document-page';

export const metadata = {
  title: 'Billing & Refunds | Provenance',
  description: 'Subscription pricing, trials, cancellations, and refund policy for Provenance Platform.',
};

export default function BillingTermsPage() {
  return <LegalDocumentPage documentId="billing" />;
}
