'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { QRCodeSVG } from 'qrcode.react';
import {
  ChevronDown,
  Link as LinkIcon,
  Lock,
  MapPin,
  Pencil,
  Printer,
  Scan,
  Share2,
} from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { formatCategoryLabel, formatConditionLabel, type CollectibleRow } from '~/lib/collectibles/constants';
import { formatMoneyCents, parseDeclaredValueCents } from '~/lib/collectibles/value';
import { recordCollectibleScanLocation } from '../../_actions/record-collectible-scan-location';
import { updateCollectibleValue } from '../../_actions/update-collectible-value';

// Reuse the artwork Leaflet scan map — it takes generic {latitude, longitude, ...}.
const ScanLocationsMap = dynamic(
  () =>
    import('~/app/artworks/[id]/certificate/_components/scan-locations-map').then(
      (mod) => mod.ScanLocationsMap,
    ),
  { ssr: false },
);

type ScanLocation = {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  formatted?: string;
  ip_city?: string;
  ip_country?: string;
  location_source?: 'gps' | 'ip' | 'none';
  scanned_at: string;
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-2 border-b border-wine/10">
      <span className="text-xs uppercase tracking-widest text-ink/50 font-serif sm:w-40 shrink-0">
        {label}
      </span>
      <span className="font-serif text-ink">{value}</span>
    </div>
  );
}

export function CollectibleCertificate({
  collectible,
  isOwner,
  ownerName,
}: {
  collectible: CollectibleRow;
  isOwner: boolean;
  ownerName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialScans: ScanLocation[] = useMemo(() => {
    const raw = (collectible.metadata as Record<string, unknown> | null)?.['scan_locations'];
    return Array.isArray(raw) ? (raw as ScanLocation[]) : [];
  }, [collectible.metadata]);

  const [scanLocations, setScanLocations] = useState<ScanLocation[]>(initialScans);

  // Value editing (owner only)
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [valueDraft, setValueDraft] = useState(collectible.value ?? '');
  const [valuePublicDraft, setValuePublicDraft] = useState(!!collectible.value_is_public);

  // Handle QR scan location tracking (mirrors artwork certificate).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('scan') !== 'true') return;

    const clearScanParam = () => {
      window.history.replaceState({}, '', window.location.pathname);
    };

    const record = async (
      loc: {
        latitude: number;
        longitude: number;
        city?: string;
        region?: string;
        country?: string;
        formatted?: string;
      } | null,
    ) => {
      try {
        const result = await recordCollectibleScanLocation(collectible.id, loc);
        if (result?.scan) {
          setScanLocations((prev) => [...prev, result.scan as ScanLocation]);
        }
        router.refresh();
      } catch (err) {
        console.error('[Collectibles] error recording scan location', err);
      } finally {
        clearScanParam();
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            );
            const geo = await res.json();
            await record({
              latitude,
              longitude,
              city: geo.city || geo.locality,
              region: geo.principalSubdivision,
              country: geo.countryName,
              formatted: geo.locality
                ? `${geo.locality}, ${geo.principalSubdivision || geo.countryName}`
                : geo.principalSubdivision
                  ? `${geo.principalSubdivision}, ${geo.countryName}`
                  : geo.countryName || undefined,
            });
          } catch {
            await record({ latitude, longitude });
          }
        },
        async () => {
          await record(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } else {
      void record(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectible.id]);

  const scanUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/collectibles/${collectible.id}/certificate?scan=true`;
  }, [collectible.id]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/collectibles/${collectible.id}/certificate`;
  }, [collectible.id]);

  const mapLocations = useMemo(
    () =>
      scanLocations
        .filter(
          (s): s is ScanLocation & { latitude: number; longitude: number } =>
            typeof s.latitude === 'number' && typeof s.longitude === 'number',
        )
        .map((s) => ({
          latitude: s.latitude,
          longitude: s.longitude,
          scanned_at: s.scanned_at,
          formatted: s.formatted,
          city: s.city,
          country: s.country,
        })),
    [scanLocations],
  );

  const handlePrint = () => window.print();

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard.');
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    const title = collectible.title || 'Collectible';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Certificate of Ownership for "${title}" on Provenance.`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    await handleCopyLink();
  };

  const handlePrintQR = () => {
    if (!scanUrl) return;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanUrl)}`;
    const win = window.open('', '_blank');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
      return;
    }
    const safeTitle = (collectible.title || 'Collectible').replace(/</g, '&lt;');
    const cert = collectible.certificate_number ?? '';
    win.document.write(`<!DOCTYPE html><html><head><title>QR Code - ${safeTitle}</title>
      <style>
        body{margin:0;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Georgia,serif;text-align:center}
        .name{font-size:18px;font-weight:bold;margin-bottom:10px;color:#4A2F25}
        .qr{margin:20px auto;border:2px solid #4A2F25;padding:10px;background:#fff}
        .qr img{display:block;width:300px;height:300px}
        .cert{margin-top:10px;font-family:'Courier New',monospace;color:#9a8060;font-size:12px}
        @media print{body{padding:20px}}
      </style></head><body>
      <div class="name">${safeTitle}</div>
      <div class="qr"><img src="${qrImg}" alt="QR code" /></div>
      ${cert ? `<div class="cert">${cert}</div>` : ''}
      <script>window.onload=function(){setTimeout(function(){window.print();},300);window.onafterprint=function(){window.close();};};</script>
      </body></html>`);
    win.document.close();
  };

  const handleSaveValue = () => {
    startTransition(async () => {
      const result = await updateCollectibleValue(collectible.id, valueDraft, valuePublicDraft);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Value updated.');
      setValueDialogOpen(false);
      router.refresh();
    });
  };

  // Value visibility: owner always sees it; others only when marked public.
  const showValue = isOwner || collectible.value_is_public;
  const valueCents = parseDeclaredValueCents(collectible.value);

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment">
      {/* Toolbar (hidden on print) */}
      <div className="print:hidden container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl pt-6 flex flex-wrap items-center justify-end gap-2">
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="font-serif text-xs sm:text-sm gap-1.5">
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Print
                <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-serif text-sm">
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print certificate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintQR}>
                <Scan className="mr-2 h-4 w-4" />
                Print QR code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>Download PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="font-serif text-xs sm:text-sm border-wine/40 hover:bg-wine/10 gap-1.5">
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Share
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="font-serif text-sm">
            <DropdownMenuItem onClick={handleCopyLink}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={() => router.push(isOwner ? '/collectibles/my' : '/collectibles')}
          variant="ghost"
          size="sm"
          className="font-serif text-xs sm:text-sm"
        >
          Back
        </Button>
      </div>

      {/* Private indicator */}
      {isOwner && collectible.is_public === false && (
        <div className="print:hidden container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl mt-4">
          <div className="flex items-center gap-2 bg-ink/5 border border-ink/15 rounded-lg p-4 text-ink/80">
            <Lock className="h-5 w-5 shrink-0" aria-hidden />
            <p className="font-serif text-sm sm:text-base">
              Private — only you can see this certificate
            </p>
          </div>
        </div>
      )}

      {/* Certificate */}
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12 max-w-4xl">
        <div className="bg-white border-4 border-double border-wine p-4 sm:p-6 md:p-12 shadow-lg print:shadow-none">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 border-b-2 border-wine pb-4 sm:pb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold text-wine mb-2 tracking-widest">
              CERTIFICATE OF OWNERSHIP
            </h1>
            <p className="text-ink/70 font-serif text-sm sm:text-base md:text-lg">
              Provenance | A Journal of Art, Objects &amp; Their Histories
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Image */}
            <div>
              {collectible.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={collectible.image_url}
                  alt={collectible.title}
                  className="w-full rounded-lg border border-wine/20 object-cover"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg border border-wine/20 bg-parchment flex items-center justify-center text-ink/40 font-serif">
                  No image
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink mb-1">
                {collectible.title}
              </h2>
              {collectible.category && (
                <p className="text-wine font-serif mb-4">
                  {formatCategoryLabel(collectible.category)}
                  {collectible.subcategory ? ` · ${collectible.subcategory}` : ''}
                </p>
              )}

              <div className="space-y-0">
                <DetailRow label="Manufacturer" value={collectible.manufacturer} />
                <DetailRow label="Year" value={collectible.year ? String(collectible.year) : null} />
                <DetailRow
                  label="Condition"
                  value={collectible.condition ? formatConditionLabel(collectible.condition) : null}
                />
                <DetailRow
                  label="Grading"
                  value={
                    collectible.grading_service || collectible.grading_score
                      ? `${collectible.grading_service ?? ''}${
                          collectible.grading_service && collectible.grading_score ? ' ' : ''
                        }${collectible.grading_score ?? ''}`.trim()
                      : null
                  }
                />
                <DetailRow label="Serial Number" value={collectible.serial_number} />
                <DetailRow label="Owner" value={ownerName} />
              </div>

              {/* Value */}
              {showValue && (valueCents > 0 || collectible.value) && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-wine/20 bg-parchment/60 p-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-ink/50 font-serif">
                      Declared Value
                    </p>
                    <p className="font-display text-xl text-wine">
                      {valueCents > 0 ? formatMoneyCents(valueCents) : collectible.value}
                    </p>
                    {isOwner && !collectible.value_is_public && (
                      <p className="text-[11px] text-ink/50 font-serif">Private — only you can see this</p>
                    )}
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="print:hidden font-serif gap-1.5"
                      onClick={() => {
                        setValueDraft(collectible.value ?? '');
                        setValuePublicDraft(!!collectible.value_is_public);
                        setValueDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
              )}
              {isOwner && !collectible.value && (
                <Button
                  variant="outline"
                  size="sm"
                  className="print:hidden mt-4 font-serif border-wine/30 hover:bg-wine/10"
                  onClick={() => {
                    setValueDraft('');
                    setValuePublicDraft(false);
                    setValueDialogOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Add a value
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          {collectible.description && (
            <div className="mt-8 pt-6 border-t border-wine/15">
              <p className="text-xs uppercase tracking-widest text-ink/50 font-serif mb-2">
                Description
              </p>
              <p className="font-serif text-ink whitespace-pre-line leading-relaxed">
                {collectible.description}
              </p>
            </div>
          )}

          {/* Footer: certificate number + QR */}
          <div className="mt-8 pt-6 border-t-2 border-wine flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <p className="text-xs uppercase tracking-widest text-ink/50 font-serif mb-1">
                Certificate Number
              </p>
              <p className="font-mono text-lg text-wine tracking-wider">
                {collectible.certificate_number ?? '—'}
              </p>
              <p className="text-xs text-ink/50 font-serif mt-2">
                Issued {new Date(collectible.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>

            {/* Owner sees a scan-tracking QR; others see a clean verify QR. */}
            <div className="text-center">
              <div className="bg-white p-2 border border-wine/20 rounded-lg inline-block">
                <QRCodeSVG value={isOwner ? scanUrl || shareUrl : shareUrl} size={120} level="M" />
              </div>
              <p className="text-[11px] text-ink/50 font-serif mt-1">Scan to verify</p>
            </div>
          </div>
        </div>

        {/* Scan locations (owner only) */}
        {isOwner && (
          <div className="print:hidden mt-8 bg-white rounded-lg border border-wine/20 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-wine" />
              <h3 className="font-display text-lg text-wine">Scan Locations</h3>
            </div>
            {mapLocations.length > 0 ? (
              <ScanLocationsMap locations={mapLocations} />
            ) : (
              <p className="font-serif text-sm text-ink/60">
                No location-tagged scans yet. When someone scans this collectible&apos;s QR code and
                shares their location, it will appear on a map here.
              </p>
            )}
            {scanLocations.length > 0 && (
              <p className="font-serif text-xs text-ink/50 mt-3">
                {scanLocations.length} total scan{scanLocations.length === 1 ? '' : 's'} recorded.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Value edit dialog */}
      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent className="font-serif">
          <DialogHeader>
            <DialogTitle className="font-display text-wine">Declared value</DialogTitle>
            <DialogDescription>
              Set what you believe this collectible is worth. It counts toward your collection total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="value-draft">Value</Label>
              <Input
                id="value-draft"
                value={valueDraft}
                onChange={(e) => setValueDraft(e.target.value)}
                placeholder="e.g., $2,500 USD"
                className="font-serif"
              />
            </div>
            <div className="flex items-center justify-between p-3 border border-wine/20 rounded-lg bg-parchment/50">
              <div className="space-y-0.5">
                <Label htmlFor="value-public-draft" className="text-sm">
                  Make value public
                </Label>
                <p className="text-xs text-ink/60">Private by default — only you can see it.</p>
              </div>
              <Switch
                id="value-public-draft"
                checked={valuePublicDraft}
                onCheckedChange={setValuePublicDraft}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setValueDialogOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              className="bg-wine text-parchment hover:bg-wine/90"
              onClick={handleSaveValue}
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save value'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
