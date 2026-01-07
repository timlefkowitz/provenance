'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Star } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { featureArtwork } from '../_actions/feature-artwork';

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
  metadata?: {
    certificate_location?: {
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country?: string;
      formatted?: string;
    };
  } | null;
};

export function CertificateOfAuthenticity({ 
  artwork, 
  isOwner = false,
  isAdmin = false
}: { 
  artwork: Artwork;
  isOwner?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [featured, setFeatured] = useState(false);

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

  const handleFeature = () => {
    startTransition(async () => {
      try {
        const result = await featureArtwork(artwork.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          setFeatured(true);
          toast.success('Artwork featured on homepage!');
          router.refresh(); // Refresh to show updated homepage
        }
      } catch (error) {
        toast.error('Something went wrong. Please try again.');
        console.error(error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-parchment">
      {/* Print controls - hidden when printing */}
      <div className="container mx-auto px-4 py-4 sm:py-6 print:hidden">
        <div className="flex flex-wrap gap-2 sm:gap-4 justify-end">
          <Button
            onClick={handleDownload}
            variant="outline"
            className="font-serif text-xs sm:text-sm"
            size="sm"
          >
            Download PDF
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif text-xs sm:text-sm"
            size="sm"
          >
            Print
          </Button>
          {isOwner && (
            <Button
              onClick={() => router.push(`/artworks/${artwork.id}/edit`)}
              variant="outline"
              className="font-serif text-xs sm:text-sm"
              size="sm"
            >
              Edit
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={handleFeature}
              disabled={pending || featured}
              variant="outline"
              className="font-serif border-wine/30 hover:bg-wine/10 text-xs sm:text-sm"
              size="sm"
            >
              <Star className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">
                {pending ? 'Featuring...' : featured ? 'Featured!' : 'Feature on Homepage'}
              </span>
              <span className="sm:hidden">
                {pending ? '...' : featured ? '✓' : 'Feature'}
              </span>
            </Button>
          )}
          <Button
            onClick={() => router.push('/artworks')}
            variant="ghost"
            className="font-serif text-xs sm:text-sm"
            size="sm"
          >
            Back
          </Button>
        </div>
      </div>

      {/* Certificate */}
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12 max-w-4xl">
        <div className="bg-white border-double-box p-4 sm:p-6 md:p-12 shadow-lg print:shadow-none">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 border-b-2 border-wine pb-4 sm:pb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold text-wine mb-2 tracking-widest">
              CERTIFICATE OF AUTHENTICITY
            </h1>
            <p className="text-ink/70 font-serif text-sm sm:text-base md:text-lg">
              Provenance | A Journal of Art, Objects & Their Histories
            </p>
          </div>

          {/* Certificate Number and QR Code */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Certificate Number</p>
              <p className="text-lg sm:text-xl font-display font-bold text-wine break-all">
                {artwork.certificate_number}
              </p>
            </div>
            {certificateUrl && (
              <div className="flex flex-col items-center sm:items-end">
                <div className="bg-white p-2 border-2 border-wine/20 rounded">
                  <QRCodeSVG
                    value={certificateUrl}
                    size={80}
                    level="H"
                    includeMargin={false}
                    className="sm:hidden"
                  />
                  <QRCodeSVG
                    value={certificateUrl}
                    size={120}
                    level="H"
                    includeMargin={false}
                    className="hidden sm:block"
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
            <div className="mb-6 sm:mb-8 text-center">
              <div className="inline-block border-2 border-wine p-2 sm:p-4 bg-parchment max-w-full">
                <div className="relative w-full max-w-full">
                  <Image
                    src={artwork.image_url}
                    alt={artwork.title}
                    width={600}
                    height={400}
                    className="object-contain w-full h-auto max-h-64 sm:max-h-80 md:max-h-96"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          )}

          {/* Artwork Details */}
          <div className="space-y-4 mb-6 sm:mb-8">
            <div className="border-b border-wine/20 pb-2">
              <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Title</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-wine break-words">
                {artwork.title}
              </p>
            </div>

            {artwork.artist_name && (
              <div className="border-b border-wine/20 pb-2">
                <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">
                  Artist
                </p>
                <Link
                  href={`/artists/${artwork.account_id}`}
                  className="text-lg sm:text-xl font-serif text-wine break-words hover:text-wine/80 underline-offset-4 hover:underline"
                >
                  {artwork.artist_name}
                </Link>
              </div>
            )}

            {artwork.description && (
              <div className="border-b border-wine/20 pb-2">
                <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Description</p>
                <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">
                  {artwork.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {artwork.creation_date && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Creation Date</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
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
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Medium</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.medium}
                  </p>
                </div>
              )}

              {artwork.dimensions && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Dimensions</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.dimensions}
                  </p>
                </div>
              )}

              <div className="border-b border-wine/20 pb-2">
                <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Date Certified</p>
                <p className="text-sm sm:text-base font-serif text-ink break-words">
                  {new Date(artwork.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {artwork.metadata?.certificate_location?.formatted && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Certificate Created In</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.metadata.certificate_location.formatted}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Provenance Information */}
          {(artwork.former_owners || artwork.auction_history || artwork.exhibition_history || 
            artwork.historic_context || artwork.celebrity_notes) && (
            <div className="border-t-2 border-wine pt-4 sm:pt-6 mt-6 sm:mt-8">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-wine mb-3 sm:mb-4">
                Provenance
              </h2>
              
              {artwork.former_owners && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Former Owners</p>
                  <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">
                    {artwork.former_owners}
                  </p>
                </div>
              )}

              {artwork.auction_history && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Auction History</p>
                  <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">
                    {artwork.auction_history}
                  </p>
                </div>
              )}

              {artwork.exhibition_history && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Exhibition History / Literature References</p>
                  <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">
                    {artwork.exhibition_history}
                  </p>
                </div>
              )}

              {artwork.historic_context && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Historic Context / Origin Information</p>
                  <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">
                    {artwork.historic_context}
                  </p>
                </div>
              )}

              {artwork.celebrity_notes && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Special Notes on Celebrity or Notable Ownership</p>
                  <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">
                    {artwork.celebrity_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Authentication Statement */}
          <div className="border-t-2 border-wine pt-4 sm:pt-6 mt-6 sm:mt-8">
            <p className="text-sm sm:text-base font-serif text-ink leading-relaxed mb-3 sm:mb-4 break-words">
              This certifies that the artwork described above has been registered in the
              Provenance registry and assigned the certificate number{' '}
              <span className="font-bold text-wine break-all">{artwork.certificate_number}</span>.
              This certificate serves as a record of authenticity and provenance for the
              artwork.
            </p>
            <p className="text-xs sm:text-sm text-ink/70 font-serif italic break-words">
              This certificate is issued by Provenance and can be verified using the
              certificate number above.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-wine/20 text-center">
            <p className="text-xs text-ink/50 font-serif">
              Provenance | Verified provenance entries and immutable historical timelines
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

