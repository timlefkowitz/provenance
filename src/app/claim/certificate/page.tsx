import { Suspense } from 'react';
import { ClaimCertificateClient } from './claim-certificate-client';

export default function ClaimCertificatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif text-ink/80">
          Loading…
        </div>
      }
    >
      <ClaimCertificateClient />
    </Suspense>
  );
}
