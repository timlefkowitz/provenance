import Link from 'next/link';
import { Ban } from 'lucide-react';

import { CERTIFICATE_TYPES, getCertificateTypeLabel } from '~/lib/user-roles';

/**
 * What anyone who isn't the holder sees at a voided certificate's URL (e.g.
 * from a printed QR code): the certificate exists but is no longer valid.
 * Shows only identifying details, never the provenance record.
 */
export function VoidedCertificateNotice({
  certificate,
}: {
  certificate: {
    title: string | null;
    artist_name: string | null;
    certificate_number: string | number | null;
    certificate_type: string | null;
    voided_at: string | null;
  };
}) {
  const label = getCertificateTypeLabel(
    certificate.certificate_type || CERTIFICATE_TYPES.AUTHENTICITY,
  );
  const voidedOn = certificate.voided_at
    ? new Date(certificate.voided_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment">
      <div className="container mx-auto max-w-lg px-4 py-16 sm:py-24">
        <div className="rounded-2xl border border-red-200 bg-white p-8 sm:p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
            <Ban className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="text-[11px] font-landing tracking-[0.28em] text-red-700 uppercase">
            Void
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-display font-bold text-wine">
            This {label} has been voided
          </h1>
          <p className="mt-4 font-serif text-ink/70 leading-relaxed">
            {certificate.title ? (
              <>
                The certificate for <strong>{certificate.title}</strong>
                {certificate.artist_name ? <> by {certificate.artist_name}</> : null}
              </>
            ) : (
              'This certificate'
            )}
            {certificate.certificate_number ? <> (No. {certificate.certificate_number})</> : null} was
            voided by its holder{voidedOn ? <> on {voidedOn}</> : null} and is no longer a valid
            record on Provenance.
          </p>
          <p className="mt-6 font-serif text-sm text-ink/50">
            <Link href="/registry" className="underline underline-offset-4 hover:text-wine">
              Search the registry
            </Link>{' '}
            for current certificates.
          </p>
        </div>
      </div>
    </div>
  );
}
