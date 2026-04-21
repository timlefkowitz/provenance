'use client';

import { Button } from '@kit/ui/button';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Share2, Facebook, Instagram, Link, Check, X, Download } from 'lucide-react';

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
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [instagramModal, setInstagramModal] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const certificateUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/artworks/${artwork.id}/certificate`;
    }
    return '';
  }, [artwork.id]);

  const shareText = useMemo(() => {
    const parts = [`"${artwork.title}"`];
    if (artwork.artist_name) parts.push(`by ${artwork.artist_name}`);
    if (artwork.description) {
      const truncated = artwork.description.length > 120
        ? artwork.description.slice(0, 117) + '…'
        : artwork.description;
      parts.push(truncated);
    }
    parts.push(`View the verified Certificate of Authenticity on Provenance.`);
    return parts.join(' — ');
  }, [artwork.title, artwork.artist_name, artwork.description]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!shareOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [shareOpen]);

  const handlePrint = () => window.print();
  const handleDownload = () => window.print();

  const handleShareFacebook = useCallback(() => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(certificateUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'width=600,height=500,noopener,noreferrer');
    setShareOpen(false);
    console.log('[Certificate] Shared to Facebook', { artworkId: artwork.id });
  }, [certificateUrl, shareText, artwork.id]);

  const handleShareInstagram = useCallback(async () => {
    // On mobile browsers the Web Share API can hand off to Instagram
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: artwork.title,
          text: shareText,
          url: certificateUrl,
        });
        console.log('[Certificate] Shared via Web Share API', { artworkId: artwork.id });
        setShareOpen(false);
        return;
      } catch (err) {
        // User cancelled or API failed — fall through to manual instructions
        console.log('[Certificate] Web Share API cancelled or failed', err);
      }
    }
    // Desktop fallback: show download + instructions modal
    setShareOpen(false);
    setInstagramModal(true);
  }, [artwork.title, artwork.id, shareText, certificateUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(certificateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      console.log('[Certificate] Certificate URL copied to clipboard', { artworkId: artwork.id });
    } catch (err) {
      console.error('[Certificate] Failed to copy link', err);
    }
    setShareOpen(false);
  }, [certificateUrl, artwork.id]);

  const handleDownloadImage = useCallback(() => {
    if (!artwork.image_url) return;
    const a = document.createElement('a');
    a.href = artwork.image_url;
    a.download = `${artwork.title.replace(/\s+/g, '-').toLowerCase()}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    console.log('[Certificate] Artwork image download triggered', { artworkId: artwork.id });
  }, [artwork.image_url, artwork.title, artwork.id]);

  return (
    <div className="min-h-screen bg-parchment">
      {/* Instagram share instructions modal */}
      {instagramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
            <button
              onClick={() => setInstagramModal(false)}
              className="absolute top-4 right-4 text-ink/40 hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                <Instagram size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-display font-bold text-ink text-lg">Share to Instagram</h3>
                <p className="text-xs text-ink/50 font-serif">Two quick steps</p>
              </div>
            </div>
            <ol className="space-y-3 mb-5">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-wine text-parchment text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <p className="text-sm font-serif text-ink">
                  Download the artwork image, then open Instagram and create a new post or story.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-wine text-parchment text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <p className="text-sm font-serif text-ink">
                  Paste the caption below into your post to include the title and description.
                </p>
              </li>
            </ol>
            {/* Pre-filled caption */}
            <div className="bg-parchment border border-wine/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-ink/50 font-serif mb-1">Suggested caption</p>
              <p className="text-sm font-serif text-ink leading-relaxed">{shareText}</p>
              <p className="text-sm font-serif text-ink mt-1 break-all">{certificateUrl}</p>
            </div>
            <div className="flex flex-col gap-2">
              {artwork.image_url && (
                <Button
                  onClick={() => { handleDownloadImage(); setInstagramModal(false); }}
                  className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-serif w-full hover:opacity-90"
                >
                  <Download size={16} className="mr-2" />
                  Download Artwork Image
                </Button>
              )}
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(`${shareText}\n${certificateUrl}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                variant="outline"
                className="font-serif w-full"
              >
                {copied ? <Check size={16} className="mr-2 text-green-600" /> : <Link size={16} className="mr-2" />}
                {copied ? 'Copied!' : 'Copy Caption & Link'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Print controls - hidden when printing */}
      <div className="container mx-auto px-4 py-6 print:hidden">
        <div className="flex flex-wrap gap-3 justify-end">
          {/* Share dropdown */}
          <div className="relative" ref={shareRef}>
            <Button
              onClick={() => setShareOpen((v) => !v)}
              variant="outline"
              className="font-serif flex items-center gap-2 border-wine/40 text-wine hover:bg-wine hover:text-parchment transition-colors"
            >
              <Share2 size={16} />
              Share Artwork
            </Button>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-wine/10 overflow-hidden z-40">
                <p className="text-xs text-ink/40 font-serif px-4 pt-3 pb-1 uppercase tracking-widest">Share to</p>
                <button
                  onClick={handleShareFacebook}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-serif text-ink hover:bg-parchment transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                    <Facebook size={16} className="text-white" />
                  </div>
                  Facebook
                </button>
                <button
                  onClick={handleShareInstagram}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-serif text-ink hover:bg-parchment transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                    <Instagram size={16} className="text-white" />
                  </div>
                  Instagram
                </button>
                <div className="border-t border-wine/10 mx-4" />
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-serif text-ink hover:bg-parchment transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center flex-shrink-0">
                    {copied ? <Check size={16} className="text-green-600" /> : <Link size={16} className="text-ink" />}
                  </div>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}
          </div>

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

