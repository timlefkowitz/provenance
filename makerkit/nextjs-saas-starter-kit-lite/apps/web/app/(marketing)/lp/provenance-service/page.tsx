import type { Metadata } from 'next';

import { ProvenanceServiceLanding } from '../_components/provenance-service-landing';
import { buildProvenanceServiceMetadata } from '../_components/provenance-service-seo';

export function generateMetadata(): Metadata {
  return buildProvenanceServiceMetadata();
}

export default function ProvenanceServiceLandingPage() {
  return <ProvenanceServiceLanding />;
}
