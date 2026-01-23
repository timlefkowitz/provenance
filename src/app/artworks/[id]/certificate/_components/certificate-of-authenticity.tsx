'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Star, Scan, MapPin } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { useUser } from '@kit/supabase/hooks/use-user';
import { featureArtwork } from '../_actions/feature-artwork';
import { isArtworkFeatured } from '~/app/admin/_actions/manage-featured-artworks';
import { recordScanLocation } from '../../_actions/record-scan-location';
import { RequestUpdateDialog } from './request-update-dialog';

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
  value: string | null;
  value_is_public: boolean | null;
  edition: string | null;
  production_location: string | null;
  owned_by: string | null;
  owned_by_is_public: boolean | null;
  sold_by: string | null;
  sold_by_is_public: boolean | null;
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
  isAdmin = false,
  creatorInfo = null
}: { 
  artwork: Artwork;
  isOwner?: boolean;
  isAdmin?: boolean;
  creatorInfo?: { name: string; role: string | null; profileId?: string } | null;
}) {
  const router = useRouter();
  const user = useUser();
  const [pending, startTransition] = useTransition();
  const [featured, setFeatured] = useState(false);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  // Initialize scan locations from artwork metadata
  const initialScanLocations = (artwork.metadata as any)?.scan_locations || [];
  const [scanLocations, setScanLocations] = useState<Array<{
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country?: string;
    formatted?: string;
    scanned_at: string;
  }>>(initialScanLocations);

  // Check if artwork is already featured on mount (only for admins, and do it lazily)
  useEffect(() => {
    if (isAdmin) {
      // Use a small delay to not block initial render
      const timeoutId = setTimeout(async () => {
        try {
          const isFeatured = await isArtworkFeatured(artwork.id);
          setFeatured(isFeatured);
        } catch (error) {
          console.error('Error checking featured status:', error);
        } finally {
          setLoadingFeatured(false);
        }
      }, 100); // Small delay to allow page to render first
      
      return () => clearTimeout(timeoutId);
    } else {
      setLoadingFeatured(false);
    }
  }, [artwork.id, isAdmin]);

  // Handle QR code scan location tracking
  useEffect(() => {
    // Check if this is a QR code scan (has ?scan=true in URL)
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const isScan = urlParams.get('scan') === 'true';
    
    if (!isScan) return;

    // Request geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Try to get reverse geocoded location
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const geoData = await response.json();
            
            const location = {
              latitude,
              longitude,
              city: geoData.city || geoData.locality,
              region: geoData.principalSubdivision,
              country: geoData.countryName,
              formatted: geoData.locality 
                ? `${geoData.locality}, ${geoData.principalSubdivision || geoData.countryName}`
                : geoData.principalSubdivision 
                  ? `${geoData.principalSubdivision}, ${geoData.countryName}`
                  : geoData.countryName || null,
            };

            // Record the scan location
            try {
              await recordScanLocation(artwork.id, location);
              
              // Update local state to show the new scan immediately
              setScanLocations(prev => [...prev, {
                ...location,
                scanned_at: new Date().toISOString(),
              }]);
              
              // Refresh page data to sync with server
              router.refresh();
              
              // Remove the scan parameter from URL to avoid re-triggering
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
            } catch (error) {
              console.error('Error recording scan location:', error);
            }
          } catch (geoError) {
            // If reverse geocoding fails, just store coordinates
            const location = {
              latitude,
              longitude,
            };

            try {
              await recordScanLocation(artwork.id, location);
              setScanLocations(prev => [...prev, {
                ...location,
                scanned_at: new Date().toISOString(),
              }]);
              router.refresh();
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
            } catch (error) {
              console.error('Error recording scan location:', error);
            }
          }
        },
        (error) => {
          // User denied geolocation or error occurred
          console.log('Geolocation not available:', error);
          // Remove scan parameter even if geolocation fails
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Don't use cached location
        }
      );
    } else {
      // Geolocation not supported
      console.log('Geolocation is not supported by this browser');
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [artwork.id]);

  // Generate the certificate URL - only for owners
  // Include ?scan=true parameter for QR code scans
  const certificateUrl = useMemo(() => {
    if (!isOwner) {
      return '';
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/artworks/${artwork.id}/certificate?scan=true`;
    }
    return '';
  }, [artwork.id, isOwner]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real implementation, you might generate a PDF here
    // For now, we'll just trigger print which allows saving as PDF
    window.print();
  };


  const handlePrintQR = () => {
    if (!certificateUrl) return;
    
    // Create a new window with just the QR code
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Use a QR code image service or generate SVG
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(certificateUrl)}`;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${artwork.title}</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: serif;
            }
            .qr-container {
              text-align: center;
              max-width: 400px;
            }
            .qr-code {
              margin: 20px auto;
              display: block;
              border: 2px solid #4A2F25;
              padding: 10px;
              background: white;
            }
            .qr-code img {
              display: block;
              width: 100%;
              height: auto;
            }
            .artist-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #4A2F25;
            }
            @media print {
              body {
                padding: 20px;
              }
              @page {
                margin: 1cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${artwork.artist_name ? `<div class="artist-name">${artwork.artist_name}</div>` : ''}
            <div class="qr-code">
              <img src="${qrCodeImageUrl}" alt="QR Code" />
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
      {/* Print controls - hidden when printing, only visible to owner */}
      <div className="container mx-auto px-4 py-4 sm:py-6 print:hidden">
        <div className="flex flex-wrap gap-2 sm:gap-4 justify-end">
          {isOwner && (
            <>
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
              {certificateUrl && (
                <Button
                  onClick={handlePrintQR}
                  variant="outline"
                  className="font-serif text-xs sm:text-sm"
                  size="sm"
                >
                  Print QR
                </Button>
              )}
            </>
          )}
          {isOwner && (
            <>
              <Button
                onClick={() => router.push(`/artworks/${artwork.id}/edit`)}
                variant="outline"
                className="font-serif text-xs sm:text-sm"
                size="sm"
              >
                Edit
              </Button>
            </>
          )}
          {isAdmin && !loadingFeatured && (
            <Button
              onClick={handleFeature}
              disabled={pending || featured}
              variant="outline"
              className={`font-serif text-xs sm:text-sm ${
                featured 
                  ? 'border-wine bg-wine/10 text-wine' 
                  : 'border-wine/30 hover:bg-wine/10'
              }`}
              size="sm"
            >
              <Star 
                className={`mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 ${
                  featured ? 'fill-wine text-wine' : ''
                }`} 
              />
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

          {/* Certificate Number and QR Code - Only visible to owner */}
          {isOwner && (
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
          )}

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

              {/* Certificate Creator */}
              {creatorInfo && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">
                    {creatorInfo.role === 'gallery' ? 'Created by Gallery' : 'Created by'}
                  </p>
                  <Link
                    href={`/artists/${artwork.account_id}${creatorInfo.role === 'gallery' ? `?role=gallery${creatorInfo.profileId ? `&profileId=${creatorInfo.profileId}` : ''}` : ''}`}
                    className="text-sm sm:text-base font-serif text-wine break-words hover:text-wine/80 underline-offset-4 hover:underline"
                  >
                    {creatorInfo.name}
                  </Link>
                </div>
              )}

              {artwork.metadata?.certificate_location?.formatted && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Certificate Created In</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.metadata.certificate_location.formatted}
                  </p>
                </div>
              )}

              {artwork.edition && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Edition</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.edition}
                  </p>
                </div>
              )}

              {artwork.production_location && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">Production Location</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.production_location}
                  </p>
                </div>
              )}

              {/* Value - show if public OR if owner */}
              {artwork.value && (artwork.value_is_public || isOwner) && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">
                    Value
                    {!artwork.value_is_public && isOwner && (
                      <span className="ml-2 text-xs text-ink/40 italic">(Private)</span>
                    )}
                  </p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.value}
                  </p>
                </div>
              )}

              {/* Owned By - show if public OR if owner */}
              {artwork.owned_by && (artwork.owned_by_is_public || isOwner) && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">
                    Owned By
                    {!artwork.owned_by_is_public && isOwner && (
                      <span className="ml-2 text-xs text-ink/40 italic">(Private)</span>
                    )}
                  </p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.owned_by}
                  </p>
                </div>
              )}
              {/* Sold By - show if public OR if owner */}
              {artwork.sold_by && (artwork.sold_by_is_public || isOwner) && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1">
                    Sold By
                    {!artwork.sold_by_is_public && isOwner && (
                      <span className="ml-2 text-xs text-ink/40 italic">(Private)</span>
                    )}
                  </p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.sold_by}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Provenance Information */}
          {(artwork.former_owners || artwork.auction_history || artwork.exhibition_history || 
            artwork.historic_context || artwork.celebrity_notes ||
            (artwork.value && artwork.value_is_public && !isOwner) ||
            (artwork.owned_by && artwork.owned_by_is_public && !isOwner) ||
            (artwork.sold_by && artwork.sold_by_is_public && !isOwner) ||
            (scanLocations && scanLocations.length > 0)) && (
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

              {/* Value in Provenance section - only show if public (owner already sees it above) */}
              {artwork.value && artwork.value_is_public && !isOwner && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Value</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.value}
                  </p>
                </div>
              )}

              {/* Owned By in Provenance section - only show if public (owner already sees it above) */}
              {artwork.owned_by && artwork.owned_by_is_public && !isOwner && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Owned By</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.owned_by}
                  </p>
                </div>
              )}

              {/* Sold By in Provenance section - only show if public (owner already sees it above) */}
              {artwork.sold_by && artwork.sold_by_is_public && !isOwner && (
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-ink/60 font-serif mb-1 font-semibold">Sold By</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.sold_by}
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

              {/* QR Code Scan Locations */}
              {scanLocations && scanLocations.length > 0 && (
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Scan className="h-4 w-4 text-wine" />
                    <p className="text-xs sm:text-sm text-ink/60 font-serif font-semibold">QR Code Scan Locations</p>
                  </div>
                  <div className="space-y-2">
                    {scanLocations.map((scan, index) => (
                      <div key={index} className="text-sm sm:text-base font-serif text-ink bg-wine/5 p-2 sm:p-3 rounded border border-wine/30">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-wine mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold mb-1 text-wine">
                              Scanned on {new Date(scan.scanned_at).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                            <p className="text-ink/80">
                              {scan.formatted || `${scan.city || ''}${scan.city && scan.country ? ', ' : ''}${scan.country || ''}`.trim() || 
                               `Lat: ${scan.latitude.toFixed(4)}, Lng: ${scan.longitude.toFixed(4)}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Authentication Statement */}
          <div className="border-t-2 border-wine pt-4 sm:pt-6 mt-6 sm:mt-8">
            <p className="text-sm sm:text-base font-serif text-ink leading-relaxed mb-3 sm:mb-4 break-words">
              This certifies that the artwork described above has been registered in the
              Provenance registry
              {isOwner ? (
                <> and assigned the certificate number{' '}
                <span className="font-bold text-wine break-all">{artwork.certificate_number}</span>.
                </>
              ) : (
                '.'
              )}
              {' '}This certificate serves as a record of authenticity and provenance for the
              artwork.
            </p>
            {isOwner && (
              <p className="text-xs sm:text-sm text-ink/70 font-serif italic break-words">
                This certificate is issued by Provenance and can be verified using the
                certificate number above.
              </p>
            )}
          </div>

          {/* Request Update Button (for non-owners) */}
          {!isOwner && user.data && (
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-wine/20 text-center">
              <RequestUpdateDialog artwork={artwork} />
            </div>
          )}

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

