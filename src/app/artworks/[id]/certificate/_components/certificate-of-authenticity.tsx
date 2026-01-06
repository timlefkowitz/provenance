'use client';

import { Button } from '@kit/ui/button';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo } from 'react';

type Artwork = {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  artist_name: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  image_url: string | null;
  certificate_number: string;
  created_at: string;
  former_owners: string | null;
  auction_history: string | null;
  exhibition_history: string | null;
  historic_context: string | null;
  celebrity_notes: string | null;
};

export function CertificateOfAuthenticity({ 
  artwork, 
  isOwner = false 
}: { 
  artwork: Artwork;
  isOwner?: boolean;
}) {
  const router = useRouter();

  // Generate the certificate URL
  const certificateUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/artworks/${artwork.id}/certificate`;
    }
    return '';
  }, [artwork.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real implementation, you might generate a PDF here
    // For now, we'll just trigger print which allows saving as PDF
    window.print();
  };

  return (
    <div className="min-h-screen bg-parchment">
      {/* Print controls - hidden when printing */}
      <div className="container mx-auto px-4 py-6 print:hidden">
        <div className="flex gap-4 justify-end">
          <Button
            onClick={handleDownload}
            variant="outline"
            className="font-serif"
          >
            Download PDF
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            Print Certificate
          </Button>
          {isOwner && (
            <Button
              onClick={() => router.push(`/artworks/${artwork.id}/edit`)}
              variant="outline"
              className="font-serif"
            >
              Edit Provenance
            </Button>
          )}
          <Button
            onClick={() => router.push('/artworks')}
            variant="ghost"
            className="font-serif"
          >
            Back to Artworks
          </Button>
        </div>
      </div>

      {/* Certificate */}
      <div className="container mx-auto px-8 py-12 max-w-4xl">
        <div className="bg-white border-double-box p-12 shadow-lg print:shadow-none">
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-wine pb-6">
            <h1 className="text-5xl font-display font-bold text-wine mb-2 tracking-widest">
              CERTIFICATE OF AUTHENTICITY
            </h1>
            <p className="text-ink/70 font-serif text-lg">
              Provenance | A Journal of Art, Objects & Their Histories
            </p>
          </div>

          {/* Certificate Number and QR Code */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <p className="text-sm text-ink/60 font-serif mb-1">Certificate Number</p>
              <p className="text-xl font-display font-bold text-wine">
                {artwork.certificate_number}
              </p>
            </div>
            {certificateUrl && (
              <div className="flex flex-col items-end">
                <div className="bg-white p-2 border-2 border-wine/20 rounded">
                  <QRCodeSVG
                    value={certificateUrl}
                    size={120}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-ink/50 font-serif mt-2 text-center max-w-[120px]">
                  Scan to verify certificate
                </p>
              </div>
            )}
          </div>

          {/* Artwork Image */}
          {artwork.image_url && (
            <div className="mb-8 text-center">
              <div className="inline-block border-2 border-wine p-4 bg-parchment">
                <Image
                  src={artwork.image_url}
                  alt={artwork.title}
                  width={600}
                  height={400}
                  className="object-contain max-h-96"
                  unoptimized
                />
              </div>
            </div>
          )}

          {/* Artwork Details */}
          <div className="space-y-4 mb-8">
            <div className="border-b border-wine/20 pb-2">
              <p className="text-sm text-ink/60 font-serif mb-1">Title</p>
              <p className="text-2xl font-display font-bold text-wine">
                {artwork.title}
              </p>
            </div>

            {artwork.artist_name && (
              <div className="border-b border-wine/20 pb-2">
                <p className="text-sm text-ink/60 font-serif mb-1">Artist</p>
                <p className="text-xl font-serif text-ink">
                  {artwork.artist_name}
                </p>
              </div>
            )}

            {artwork.description && (
              <div className="border-b border-wine/20 pb-2">
                <p className="text-sm text-ink/60 font-serif mb-1">Description</p>
                <p className="text-base font-serif text-ink whitespace-pre-wrap">
                  {artwork.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {artwork.creation_date && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-sm text-ink/60 font-serif mb-1">Creation Date</p>
                  <p className="text-base font-serif text-ink">
                    {new Date(artwork.creation_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}

              {artwork.medium && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-sm text-ink/60 font-serif mb-1">Medium</p>
                  <p className="text-base font-serif text-ink">
                    {artwork.medium}
                  </p>
                </div>
              )}

              {artwork.dimensions && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-sm text-ink/60 font-serif mb-1">Dimensions</p>
                  <p className="text-base font-serif text-ink">
                    {artwork.dimensions}
                  </p>
                </div>
              )}

              <div className="border-b border-wine/20 pb-2">
                <p className="text-sm text-ink/60 font-serif mb-1">Date Certified</p>
                <p className="text-base font-serif text-ink">
                  {new Date(artwork.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Provenance Information */}
          {(artwork.former_owners || artwork.auction_history || artwork.exhibition_history || 
            artwork.historic_context || artwork.celebrity_notes) && (
            <div className="border-t-2 border-wine pt-6 mt-8">
              <h2 className="text-2xl font-display font-bold text-wine mb-4">
                Provenance
              </h2>
              
              {artwork.former_owners && (
                <div className="mb-4">
                  <p className="text-sm text-ink/60 font-serif mb-1 font-semibold">Former Owners</p>
                  <p className="text-base font-serif text-ink whitespace-pre-wrap">
                    {artwork.former_owners}
                  </p>
                </div>
              )}

              {artwork.auction_history && (
                <div className="mb-4">
                  <p className="text-sm text-ink/60 font-serif mb-1 font-semibold">Auction History</p>
                  <p className="text-base font-serif text-ink whitespace-pre-wrap">
                    {artwork.auction_history}
                  </p>
                </div>
              )}

              {artwork.exhibition_history && (
                <div className="mb-4">
                  <p className="text-sm text-ink/60 font-serif mb-1 font-semibold">Exhibition History / Literature References</p>
                  <p className="text-base font-serif text-ink whitespace-pre-wrap">
                    {artwork.exhibition_history}
                  </p>
                </div>
              )}

              {artwork.historic_context && (
                <div className="mb-4">
                  <p className="text-sm text-ink/60 font-serif mb-1 font-semibold">Historic Context / Origin Information</p>
                  <p className="text-base font-serif text-ink whitespace-pre-wrap">
                    {artwork.historic_context}
                  </p>
                </div>
              )}

              {artwork.celebrity_notes && (
                <div className="mb-4">
                  <p className="text-sm text-ink/60 font-serif mb-1 font-semibold">Special Notes on Celebrity or Notable Ownership</p>
                  <p className="text-base font-serif text-ink whitespace-pre-wrap">
                    {artwork.celebrity_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Authentication Statement */}
          <div className="border-t-2 border-wine pt-6 mt-8">
            <p className="text-base font-serif text-ink leading-relaxed mb-4">
              This certifies that the artwork described above has been registered in the
              Provenance registry and assigned the certificate number{' '}
              <span className="font-bold text-wine">{artwork.certificate_number}</span>.
              This certificate serves as a record of authenticity and provenance for the
              artwork.
            </p>
            <p className="text-sm text-ink/70 font-serif italic">
              This certificate is issued by Provenance and can be verified using the
              certificate number above.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-wine/20 text-center">
            <p className="text-xs text-ink/50 font-serif">
              Provenance | Verified provenance entries and immutable historical timelines
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

