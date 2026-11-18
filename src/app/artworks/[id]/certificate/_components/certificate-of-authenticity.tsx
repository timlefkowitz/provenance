'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Star, Scan, MapPin, CheckCircle2, AlertCircle, Facebook, Instagram, Trash2, Share2, Printer, ChevronDown, Tag, Link as LinkIcon, FileText, Lock, ArrowLeft, Pencil, Send, Download, MoreHorizontal, MessageSquare, Upload, ListPlus, Ban, BadgeCheck } from 'lucide-react';
import { Button } from '@kit/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { useCurrentUser } from '~/hooks/use-current-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { featureArtwork } from '../_actions/feature-artwork';
import { adminDeleteArtwork } from '../../_actions/admin-delete-artwork';
import { UploadAttachmentsDialog, type ArtworkAttachmentRow } from './upload-attachments-dialog';
import { ArtworkPublications } from './artwork-publications';
import { ProvenanceValueLine } from './provenance-value-line';
import { SoldDot } from '~/components/sold-dot';
import type { ArtworkPublication, ProvenanceValue } from '~/lib/valuation/provenance-value';
import type { ChainCertificate } from '~/lib/provenance/load-chain-certificates';
import { setValueCents } from '~/lib/sales/sale-money';
import { isArtworkFeatured } from '~/app/admin/_actions/manage-featured-artworks';
import { recordScanLocation } from '../../_actions/record-scan-location';
import { EMPTY_SCAN_STATS, formatScanStats, type ScanStats } from '~/lib/scan-stats';
import { getScanVisitorId } from '~/lib/scan-visitor';
import { shareLink } from '~/lib/capacitor/share';
import { verifyCertificate } from '../../_actions/verify-certificate';
import { RequestUpdateDialog } from './request-update-dialog';
import { EditArtworkDialog } from './edit-artwork-dialog';
import { getCertificateTypeLabel, type CertificateType, CERTIFICATE_TYPES } from '~/lib/user-roles';
import { ClaimAsArtistDialog } from './claim-as-artist-dialog';
import { InviteCooFromCoaDialog } from './invite-coo-from-coa-dialog';
import { SendCertificateDialog } from './send-certificate-dialog';
import { PendingCooInviteStatus } from './pending-coo-invite-status';
import { VoidCertificateButton, VoidedCertificateBanner } from './void-certificate-controls';
import { getArtistPublicProfileHref } from '~/lib/artist-profile-link';
import { buildWallLabelsHtml, openPrintWindow } from '~/app/artworks/edit-provenance/_components/print-menu';
import { AddToListButton } from '~/app/artworks/_components/add-to-list-button';
import { loadPriceSymbolPref } from '~/lib/print-price';
import {
  ProvenanceValuationBlock,
  type ProvenanceValuation,
} from './provenance-valuation-block';

// Provenance Valuation is hidden on certificates while the feature is reworked.
// Flip to true to bring the block (and the "Submit valuation" CTA) back.
const SHOW_PROVENANCE_VALUATION = false;
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@kit/ui/popover';

const ScanLocationsMap = dynamic(
  () => import('./scan-locations-map').then((mod) => mod.ScanLocationsMap),
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
  ip_region?: string;
  ip_country?: string;
  ip_latitude?: number;
  ip_longitude?: number;
  user_agent?: string;
  accept_language?: string;
  location_source?: 'gps' | 'ip' | 'none';
  scanned_at: string;
};

export type Artwork = {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  artist_name: string | null;
  artist_account_id?: string | null;
  artist_profile_id?: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  image_url: string | null;
  /** Untouched upload behind an edited image_url; null when image_url is the original. */
  original_image_url?: string | null;
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
  is_sold?: boolean | null;
  sold_at?: string | null;
  sold_price_cents?: number | null;
  sold_currency?: string | null;
  is_public?: boolean | null;
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
  provenance_history?: ProvenanceHistoryEntry[] | null;
};

/** Set on entries mirrored from a linked certificate (see lib/provenance/chain.ts). */
type ProvenanceSyncTag = {
  certificate_type: string | null;
  artwork_id: string;
  method: string;
  actor_name: string | null;
};

type ProvenanceHistoryEntry = {
  editedAt: string;
  editedBy: string | null;
  previousValues: Record<string, unknown>;
  via?: ProvenanceSyncTag;
};

const SYNC_CERT_LABEL: Record<string, string> = {
  authenticity: 'CoA',
  show: 'CoS',
  ownership: 'CoO',
};

const SYNC_METHOD_LABEL: Record<string, string> = {
  edit: 'edited',
  sale: 'sale recorded',
  ownership_accepted: 'ownership accepted',
  ownership_transfer: 'ownership transferred',
  request_approved: 'request approved',
  coo_issued: 'CoO issued',
  cos_issued: 'CoS issued',
  coa_issued: 'CoA issued',
  backfill: 'records updated',
};

/** "via CoO · ownership accepted" */
function formatExhibitionDate(date: string): string {
  // Date-only values ("2026-11-05") parse as UTC midnight; format in UTC so
  // US viewers don't see the day before.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

function syncTagLabel(tag: ProvenanceSyncTag): string {
  const cert = (tag.certificate_type && SYNC_CERT_LABEL[tag.certificate_type]) || 'linked certificate';
  return `via ${cert} · ${SYNC_METHOD_LABEL[tag.method] ?? tag.method.replace(/_/g, ' ')}`;
}

/**
 * Maps the DB column name used on the Artwork object to the key stored in
 * provenance_history[].previousValues (which mirrors the action's input names).
 */
const FIELD_HISTORY_KEY: Record<string, string> = {
  title: 'title',
  artist_name: 'artist_name',
  description: 'description',
  medium: 'medium',
  creation_date: 'creationDate',
  dimensions: 'dimensions',
  former_owners: 'formerOwners',
  auction_history: 'auctionHistory',
  exhibition_history: 'exhibitionHistory',
  historic_context: 'historicContext',
  celebrity_notes: 'celebrityNotes',
  value: 'value',
  edition: 'edition',
  production_location: 'productionLocation',
  owned_by: 'ownedBy',
  sold_by: 'soldBy',
};

function FieldWithHistory({
  dbField,
  currentValue,
  history,
  renderValue,
}: {
  dbField: string;
  currentValue: string | null | undefined;
  history: ProvenanceHistoryEntry[] | null | undefined;
  renderValue: (v: string) => React.ReactNode;
}) {
  const historyKey = FIELD_HISTORY_KEY[dbField] ?? dbField;
  // Hand edits store the form's key (formerOwners); mirrored entries store the column (former_owners).
  const previousOf = (e: ProvenanceHistoryEntry) =>
    historyKey in e.previousValues ? e.previousValues[historyKey] : e.previousValues[dbField];
  const touches = (e: ProvenanceHistoryEntry) =>
    historyKey in e.previousValues || dbField in e.previousValues;

  const sorted = (history ?? [])
    .filter(touches)
    .sort((a, b) => new Date(a.editedAt).getTime() - new Date(b.editedAt).getTime());
  const edits = sorted.filter((e) => previousOf(e) != null && previousOf(e) !== '');
  const latest = sorted[sorted.length - 1];
  const latestTag = latest?.via;

  if (!currentValue) return null;

  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="flex-1">{renderValue(currentValue)}</span>
      {latestTag && (
        <span
          className="print:hidden shrink-0 mt-0.5 rounded-full border border-wine/20 bg-wine/5 px-2 py-0.5 text-[10px] font-serif text-wine/80"
          title={latestTag.actor_name ? `Updated by ${latestTag.actor_name}` : undefined}
        >
          {syncTagLabel(latestTag)} ·{' '}
          {new Date(latest!.editedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      {edits.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="print:hidden shrink-0 text-xs font-serif italic text-ink/40 hover:text-ink/70 transition-colors cursor-pointer underline underline-offset-2 decoration-dotted mt-0.5"
            >
              edited
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-72 p-3 font-serif text-xs text-ink print:hidden"
          >
            <p className="font-semibold text-wine mb-2 text-sm">Edit history</p>
            <ol className="space-y-2">
              {edits.map((entry, idx) => (
                <li key={idx} className="border-l-2 border-wine/20 pl-2">
                  <p className="text-ink/50 mb-0.5">
                    {new Date(entry.editedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-ink/70 italic">
                    &ldquo;{String(previousOf(entry))}&rdquo;
                  </p>
                  {entry.via && <p className="text-wine/70 mt-0.5">{syncTagLabel(entry.via)}</p>}
                </li>
              ))}
              <li className="border-l-2 border-wine/60 pl-2">
                <p className="text-ink/50 mb-0.5">Current</p>
                <p className="text-ink font-medium">&ldquo;{currentValue}&rdquo;</p>
              </li>
            </ol>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function CertificateOfAuthenticity({ 
  artwork, 
  isOwner = false,
  canEditCertificate = false,
  canSell = false,
  canRequestProvenance = false,
  isAdmin = false,
  creatorInfo = null,
  exhibition = null,
  exhibitions,
  showVerifyCta = false,
  certificateStatus = null,
  certificateType = 'authenticity',
  attachments = [],
  valuation = null,
  publications = [],
  scanStats = EMPTY_SCAN_STATS,
  provenanceValue = null,
  linkedCertificates = [],
  voided = null,
}: {
  artwork: Artwork;
  isOwner?: boolean;
  /** Owner or gallery team member who can edit artwork / uploads */
  canEditCertificate?: boolean;
  /** May record a sale / issue a Certificate of Ownership (holder, team, or a manager of a show that hung it). */
  canSell?: boolean;
  canRequestProvenance?: boolean;
  isAdmin?: boolean;
  creatorInfo?: { name: string; role: string | null; profileId?: string; slug?: string; accountId?: string } | null;
  exhibition?: { 
    id: string; 
    title: string; 
    start_date: string; 
    end_date: string | null; 
    location: string | null;
    curator?: string | null;
    curatorHref?: string | null;
    gallery?: { id: string; name: string; profileId?: string; slug?: string } | null;
  } | null;
  /** Every exhibition the work has been selected for, newest first. */
  exhibitions?: Array<{
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    curator?: string | null;
    curatorHref?: string | null;
    gallery?: { id: string; name: string; profileId?: string; slug?: string } | null;
  }>;
  showVerifyCta?: boolean;
  certificateStatus?: string | null;
  certificateType?: CertificateType | string;
  attachments?: ArtworkAttachmentRow[];
  valuation?: ProvenanceValuation | null;
  /** Publications this work has appeared in (artworks.publications). */
  publications?: ArtworkPublication[];
  /** Public scan counts; per-scan details only reach the owner and admins. */
  scanStats?: ScanStats;
  /** Chain-wide Provenance Value (loadChainProvenanceValues): same on every linked certificate. */
  provenanceValue?: ProvenanceValue | null;
  /** Every CoA / CoS / CoO issued for this work (loadChainCertificates), this one included. */
  linkedCertificates?: ChainCertificate[];
  /** Set when the certificate is void (in the holder's Archive). */
  voided?: { at: string | null; reason: string | null } | null;
}) {
  const exhibitionList = exhibitions ?? (exhibition?.title ? [exhibition] : []);
  const isSold = !!(artwork.is_sold || artwork.sold_at);

  // Log when component mounts to confirm we reached this point
  useEffect(() => {
    console.log('[v0] [CertificateOfAuthenticity] Component mounted', {
      artworkId: artwork.id,
      title: artwork.title,
      isOwner,
      certificateType,
      certificateStatus,
    });
  }, [artwork.id, artwork.title, isOwner, certificateType, certificateStatus]);

  const router = useRouter();
  // A Certificate of Ownership is issued from the artist's CoA or the show's CoS,
  // by the holder, their team, or a manager of a show that hung the work.
  const canIssueOwnership =
    (isOwner || canEditCertificate || canSell) &&
    (certificateType === CERTIFICATE_TYPES.AUTHENTICITY || certificateType === CERTIFICATE_TYPES.SHOW);
  const [issueCooOpen, setIssueCooOpen] = useState(false);
  // Dialogs opened from the toolbar menus
  const [sendOpen, setSendOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const hasMoreMenu = isOwner || canEditCertificate || isAdmin;
  const user = useCurrentUser();
  const [pending, startTransition] = useTransition();
  const [verifying, setVerifying] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [imageError, setImageError] = useState(false);
  // Initialize scan locations from artwork metadata
  const initialScanLocations = (artwork.metadata as any)?.scan_locations || [];
  const [scanLocations, setScanLocations] = useState<ScanLocation[]>(initialScanLocations);

  const [canClaimAsArtist, setCanClaimAsArtist] = useState(false);
  const artistPublicHref = useMemo(
    () =>
      getArtistPublicProfileHref({
        artist_account_id: artwork.artist_account_id ?? null,
        artist_profile_id: artwork.artist_profile_id ?? null,
      }),
    [artwork.artist_account_id, artwork.artist_profile_id],
  );

  const scanLocationsWithCoordinates = useMemo(
    () =>
      scanLocations.filter(
        (scan): scan is ScanLocation & { latitude: number; longitude: number } =>
          Number.isFinite(scan.latitude) &&
          Number.isFinite(scan.longitude) &&
          Math.abs(scan.latitude!) <= 90 &&
          Math.abs(scan.longitude!) <= 180,
      ),
    [scanLocations],
  );

  const canViewScanMap = isOwner || isAdmin;

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

  const client = useSupabase();
  useEffect(() => {
    async function checkClaimAsArtistEligibility() {
      if (!user.data) {
        setCanClaimAsArtist(false);
        return;
      }
      const isShowOrOwnership =
        certificateType === CERTIFICATE_TYPES.SHOW || certificateType === CERTIFICATE_TYPES.OWNERSHIP;
      if (!isShowOrOwnership) {
        setCanClaimAsArtist(false);
        return;
      }
      try {
        const { data: account } = await client
          .from('accounts')
          .select('id, public_data')
          .eq('id', user.data.id)
          .single();
        if (!account) {
          setCanClaimAsArtist(false);
          return;
        }
        const userRole = getUserRole(account.public_data as Record<string, unknown>);
        // Any artist can request; the certificate owner approves identity. Email completes the CoA.
        setCanClaimAsArtist(userRole === USER_ROLES.ARTIST);
      } catch (error) {
        console.error('[Certificate] Error checking claim as artist eligibility', error);
        setCanClaimAsArtist(false);
      }
    }
    checkClaimAsArtistEligibility();
  }, [user.data, client, certificateType]);

  // Handle QR code scan location tracking
  useEffect(() => {
    // Check if this is a QR code scan (has ?scan=true in URL)
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const isScan = urlParams.get('scan') === 'true';
    
    if (!isScan) return;

    // Count the scan even if the visitor never answers the location prompt:
    // the timeout option only starts once permission is granted.
    let settled = false;
    const settle = () => {
      if (settled) return false;
      settled = true;
      return true;
    };
    const promptFallback = window.setTimeout(async () => {
      if (!settle()) return;
      try {
        const result = await recordScanLocation(artwork.id, null, getScanVisitorId());
        if (result?.scan) setScanLocations(prev => [...prev, result.scan as ScanLocation]);
      } catch (err) {
        console.error('[CertificateScan] Error recording scan (prompt unanswered):', err);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }, 15000);

    // Request geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!settle()) return;
          window.clearTimeout(promptFallback);
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

            try {
              const result = await recordScanLocation(artwork.id, location, getScanVisitorId());
              setScanLocations(prev => [...prev, (result?.scan ?? { ...location, scanned_at: new Date().toISOString() }) as ScanLocation]);
              router.refresh();
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
            } catch (error) {
              console.error('[CertificateScan] Error recording scan location:', error);
            }
          } catch {
            // Reverse geocoding failed — store raw coordinates only
            const location = { latitude, longitude };

            try {
              const result = await recordScanLocation(artwork.id, location, getScanVisitorId());
              setScanLocations(prev => [...prev, (result?.scan ?? { ...location, scanned_at: new Date().toISOString() }) as ScanLocation]);
              router.refresh();
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
            } catch (error) {
              console.error('[CertificateScan] Error recording scan (coords only):', error);
            }
          }
        },
        async (error) => {
          if (!settle()) return;
          window.clearTimeout(promptFallback);
          // User denied geolocation or it errored — still record the scan event
          // so the owner sees it happened (no location is recorded).
          console.log('[CertificateScan] Geolocation not available:', error);
          try {
            const result = await recordScanLocation(artwork.id, null, getScanVisitorId());
            if (result?.scan) {
              setScanLocations(prev => [...prev, result.scan as ScanLocation]);
            }
          } catch (err) {
            console.error('[CertificateScan] Error recording scan (no GPS):', err);
          }
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
      // Geolocation API not available — still record the scan event (no location)
      console.log('[CertificateScan] Geolocation not supported by this browser');
      settle();
      window.clearTimeout(promptFallback);
      void (async () => {
        try {
          const result = await recordScanLocation(artwork.id, null, getScanVisitorId());
          if (result?.scan) {
            setScanLocations((prev) => [...prev, result.scan as ScanLocation]);
          }
        } catch (err) {
          console.error('[CertificateScan] Error recording scan (no geo API):', err);
        }
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      })();
    }

    return () => window.clearTimeout(promptFallback);
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

  // Public share URL — no query params, clean canonical link
  const shareUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/artworks/${artwork.id}/certificate`;
    }
    return '';
  }, [artwork.id]);

  const handleShare = async () => {
    if (!shareUrl) return;
    const artworkTitle = artwork.title || 'Artwork';
    const result = await shareLink({
      title: artworkTitle,
      text: artwork.artist_name
        ? `Certificate of Authenticity for "${artworkTitle}" by ${artwork.artist_name}.`
        : `Certificate of Authenticity for "${artworkTitle}".`,
      url: shareUrl,
    });
    if (result === 'copied') toast.success('Link copied to clipboard.');
    else if (result === 'failed') await handleCopyLink();
  };

  const handleShareFacebook = () => {
    if (!shareUrl) return;
    console.log('[Certificate] share to Facebook', { artworkId: artwork.id });
    // Open in a new tab — Facebook's crawler reads the og:image meta tag on the
    // certificate page and shows the artwork image in the post/story preview.
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleShareInstagram = async () => {
    if (!shareUrl) return;
    console.log('[Certificate] share to Instagram', { artworkId: artwork.id });

    const artworkTitle = artwork.title || 'Artwork';
    const shareText = artwork.artist_name
      ? `Certificate of Authenticity for "${artworkTitle}" by ${artwork.artist_name}.`
      : `Certificate of Authenticity for "${artworkTitle}".`;

    // On mobile: try sharing the actual image file so the native share sheet
    // allows posting directly to Instagram Stories/Feed.
    if (artwork.image_url && typeof navigator !== 'undefined' && navigator.share) {
      try {
        const response = await fetch(artwork.image_url);
        const blob = await response.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const file = new File([blob], `${artworkTitle}.${ext}`, { type: blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: artworkTitle, text: shareText, url: shareUrl });
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[Certificate] image file share failed, falling back', err);
      }
    }

    // Mobile without file share support: share URL via native sheet
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: artworkTitle, text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[Certificate] navigator.share failed', err);
      }
    }

    // Desktop: download the artwork image + copy the link so the user can
    // open Instagram and post both manually.
    if (artwork.image_url) {
      try {
        const response = await fetch(artwork.image_url);
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${artworkTitle}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Image downloaded & link copied — open Instagram to share!');
        return;
      } catch (e) {
        console.error('[Certificate] image download failed', e);
      }
    }

    // Last resort: copy link only
    await navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied — paste it into your Instagram story or bio.');
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard.');
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintWallLabel = () => {
    console.log('[Certificate] Print wall label', { artworkId: artwork.id });
    openPrintWindow(buildWallLabelsHtml([artwork], {}, loadPriceSymbolPref()), 900, 720);
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
              font-family: "Gotham", -apple-system, BlinkMacSystemFont, "Segoe UI",
                system-ui, sans-serif;
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
      {/* Toolbar — hidden when printing.
          Back on the left; on the right one Edit, then Share and Print menus,
          and everything occasional behind "More". */}
      <div className="container mx-auto px-4 py-4 sm:py-6 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <Button
            onClick={() => router.push('/artworks')}
            variant="ghost"
            className="font-serif text-xs sm:text-sm gap-1 -ml-2 text-ink/70 hover:text-ink"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Artworks</span>
            <span className="sr-only sm:hidden">Back to artworks</span>
          </Button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isOwner && (
              <Button
                onClick={() => router.push(`/artworks/${artwork.id}/edit`)}
                variant="outline"
                className="font-serif text-xs sm:text-sm gap-1.5"
                size="sm"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Button>
            )}

            {/* Share — everyone. Emailing it to a person lives here too. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  className="font-serif text-xs sm:text-sm gap-1.5 bg-wine text-parchment hover:bg-wine/90"
                  size="sm"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden />
                  Share
                  <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="font-serif text-sm min-w-[13rem]">
                {canEditCertificate && (
                  <>
                    <DropdownMenuItem onSelect={() => setSendOpen(true)}>
                      <Send className="mr-2 h-4 w-4" />
                      Email to someone…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={handleCopyLink}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share via…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleShareFacebook}>
                  <Facebook className="mr-2 h-4 w-4" />
                  Facebook
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleShareInstagram}>
                  <Instagram className="mr-2 h-4 w-4" />
                  Instagram
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Print — certificate, wall label, QR, PDF */}
            {isOwner && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="font-serif text-xs sm:text-sm gap-1.5"
                    size="sm"
                    aria-label="Print"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Print</span>
                    <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="font-serif text-sm min-w-[12rem]">
                  <DropdownMenuItem onSelect={handlePrint}>
                    <FileText className="mr-2 h-4 w-4" />
                    Certificate
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handlePrintWallLabel}>
                    <Tag className="mr-2 h-4 w-4" />
                    Wall label
                  </DropdownMenuItem>
                  {certificateUrl && (
                    <DropdownMenuItem onSelect={handlePrintQR}>
                      <Scan className="mr-2 h-4 w-4" />
                      QR code
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Save as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* More — occasional and destructive actions */}
            {hasMoreMenu && (
              <div className="relative">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-serif px-2"
                      aria-label="More actions"
                      disabled={pending}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="font-serif text-sm min-w-[13rem]">
                    {isOwner && (
                      <DropdownMenuItem onSelect={() => router.push(`/artworks/${artwork.id}/inquiries`)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Inquiries
                      </DropdownMenuItem>
                    )}
                    {canEditCertificate && (
                      <DropdownMenuItem onSelect={() => setUploadOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Images & documents
                      </DropdownMenuItem>
                    )}
                    {isOwner && (
                      <DropdownMenuItem onSelect={() => setListsOpen(true)}>
                        <ListPlus className="mr-2 h-4 w-4" />
                        Add to list…
                      </DropdownMenuItem>
                    )}
                    {canEditCertificate && !voided && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setVoidOpen(true)}
                          className="text-red-700 focus:text-red-700 focus:bg-red-50"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Void certificate…
                        </DropdownMenuItem>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-ink/40 font-normal">
                          Admin
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={handleFeature}
                          disabled={pending || featured || loadingFeatured}
                        >
                          <Star className={`mr-2 h-4 w-4 ${featured ? 'fill-wine text-wine' : ''}`} aria-hidden />
                          {pending ? 'Featuring...' : featured ? 'Featured on homepage' : 'Feature on homepage'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setDeleteOpen(true)}
                          disabled={pending}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                          Delete certificate…
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {isOwner && (
                  <AddToListButton
                    artworkIds={[artwork.id]}
                    open={listsOpen}
                    onOpenChange={setListsOpen}
                    anchor={<span aria-hidden className="pointer-events-none absolute inset-0" />}
                    className="absolute inset-0 pointer-events-none"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dialogs opened from the menus above */}
        {canEditCertificate && (
          <SendCertificateDialog
            artworkId={artwork.id}
            artworkTitle={artwork.title || 'Untitled'}
            onIssueOwnership={canIssueOwnership ? () => setIssueCooOpen(true) : undefined}
            open={sendOpen}
            onOpenChange={setSendOpen}
            hideTrigger
          />
        )}
        {canEditCertificate && (
          <UploadAttachmentsDialog
            artworkId={artwork.id}
            artworkTitle={artwork.title || 'Untitled'}
            attachments={attachments}
            isCreatorForEdit={canEditCertificate}
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            hideTrigger
          />
        )}
        {canEditCertificate && !voided && (
          <VoidCertificateButton
            artworkId={artwork.id}
            artworkTitle={artwork.title || 'Untitled'}
            open={voidOpen}
            onOpenChange={setVoidOpen}
            hideTrigger
          />
        )}
        {canIssueOwnership && (
          <InviteCooFromCoaDialog
            artworkId={artwork.id}
            artworkTitle={artwork.title || 'Untitled'}
            isShowCertificate={certificateType === CERTIFICATE_TYPES.SHOW}
            defaultPriceCents={setValueCents(artwork)}
            open={issueCooOpen}
            onOpenChange={setIssueCooOpen}
            hideTrigger
          />
        )}
        {isAdmin && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this certificate?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{artwork.title || 'this artwork'}</strong> and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await adminDeleteArtwork(artwork.id);
                        toast.success('Artwork deleted.');
                        router.push('/artworks');
                      } catch (err) {
                        console.error('[Certificate] adminDeleteArtwork failed', err);
                        toast.error(err instanceof Error ? err.message : 'Failed to delete artwork');
                      }
                    });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Private certificate indicator — owner only */}
      {isOwner && artwork.is_public === false && (
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl mb-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-ink/10 bg-white/60 px-4 py-3 text-ink/70">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            <p className="font-serif text-sm">
              Private — only you can see this certificate
            </p>
          </div>
        </div>
      )}

      {/* Verify certificate banner – shown when owner arrives from notification */}
      {isOwner && showVerifyCta && (
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl mb-4">
          {certificateStatus === 'pending_verification' ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-wine/20 bg-wine/5 px-4 py-3">
              <p className="flex-1 font-serif text-sm text-ink">
                An artist has claimed this certificate. Review the details below to confirm the claim, then verify to complete the process.
              </p>
              <Button
                onClick={() => {
                  setVerifying(true);
                  startTransition(async () => {
                    try {
                      const result = await verifyCertificate(artwork.id);
                      if (result.success) {
                        toast.success('Certificate verified.');
                        router.refresh();
                      } else {
                        toast.error(result.error || 'Failed to verify certificate');
                      }
                    } catch {
                      toast.error('Failed to verify certificate');
                    } finally {
                      setVerifying(false);
                    }
                  });
                }}
                disabled={verifying || pending}
                size="sm"
                className="shrink-0 font-serif text-xs sm:text-sm gap-1.5 bg-wine text-parchment hover:bg-wine/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {verifying || pending ? 'Verifying...' : 'Verify certificate'}
              </Button>
            </div>
          ) : certificateStatus === 'verified' ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="font-serif text-sm">This certificate has been verified.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="font-serif text-sm">
                Certificate is not ready for verification. It may have already been verified or the claim is still in progress.
              </p>
            </div>
          )}
        </div>
      )}

      {voided && (
        <VoidedCertificateBanner
          artworkId={artwork.id}
          voidedAt={voided.at}
          reason={voided.reason}
          canRestore={canEditCertificate}
        />
      )}

      {/* Certificate */}
      <div className="container mx-auto px-4 sm:px-6 md:px-8 pt-2 pb-10 sm:pb-16 max-w-4xl print:p-0">
        <div className="relative overflow-hidden rounded-xl border border-ink/10 bg-white px-5 py-8 sm:px-10 sm:py-12 md:px-14 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-20px_rgba(0,0,0,0.18)] print:rounded-none print:border-ink/30 print:shadow-none">
          {voided && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
            >
              <span className="-rotate-[24deg] select-none rounded-md border-[6px] border-red-700/35 px-8 py-2 font-display text-7xl sm:text-8xl font-bold tracking-[0.3em] text-red-700/35">
                VOID
              </span>
            </div>
          )}
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/45 font-serif mb-3">
              Provenance Registry
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold tracking-tight text-wine">
              {getCertificateTypeLabel(certificateType)}
            </h1>
            <p className="mt-2 text-ink/55 font-serif text-xs sm:text-sm">
              A Journal of Art, Objects &amp; Their Histories
            </p>
          </div>

          {/* Certificate Number and QR Code - Only visible to owner */}
          {isOwner && (
            <div className="flex flex-row justify-between items-center gap-4 mb-8 rounded-lg border border-ink/10 bg-parchment/50 p-4 sm:p-5">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Certificate Number</p>
                <p className="text-base sm:text-lg font-display font-semibold tracking-wide text-wine break-all">
                  {artwork.certificate_number}
                </p>
              </div>
              {certificateUrl && (
                <div className="flex flex-col items-center shrink-0">
                  <div className="bg-white p-1.5 border border-ink/10 rounded-md">
                    <QRCodeSVG
                      value={certificateUrl}
                      size={72}
                      level="H"
                      includeMargin={false}
                      className="sm:hidden"
                    />
                    <QRCodeSVG
                      value={certificateUrl}
                      size={96}
                      level="H"
                      includeMargin={false}
                      className="hidden sm:block"
                    />
                  </div>
                  <p className="text-[10px] text-ink/45 font-serif mt-1.5 text-center">
                    Scan to verify
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Artwork Image */}
          {artwork.image_url && (
            <div className="mb-8 sm:mb-10 flex justify-center rounded-lg bg-parchment/60 p-3 sm:p-6">
              <div className="max-w-full">
                {imageError ? (
                  <div className="w-full min-h-48 flex items-center justify-center text-ink/50 font-serif py-12">
                    Image unavailable
                  </div>
                ) : (
                  <div className="relative w-full max-w-full">
                    <Image
                      src={artwork.image_url}
                      alt={artwork.title}
                      width={600}
                      height={400}
                      className="object-contain w-full h-auto max-h-72 sm:max-h-96 md:max-h-[28rem] rounded-sm"
                      unoptimized
                      onError={() => setImageError(true)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Artwork Details */}
          <div className="space-y-4">
            <div className="border-t border-ink/10 pt-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Title</p>
              <FieldWithHistory
                dbField="title"
                currentValue={artwork.title || 'Untitled Artwork'}
                history={artwork.provenance_history}
                renderValue={(v) => (
                  <p className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-wine break-words">
                    {v}
                    {isSold && <SoldDot className="ml-2 -mt-1" />}
                  </p>
                )}
              />
            </div>

            {artwork.artist_name && (
              <div className="border-t border-ink/10 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">
                  Artist
                </p>
                <FieldWithHistory
                  dbField="artist_name"
                  currentValue={artwork.artist_name}
                  history={artwork.provenance_history}
                  renderValue={(v) =>
                    artistPublicHref ? (
                      <Link
                        href={artistPublicHref}
                        className="text-base sm:text-lg font-serif text-wine break-words hover:text-wine/80 underline-offset-4 hover:underline"
                      >
                        {v}
                      </Link>
                    ) : (
                      <p className="text-base sm:text-lg font-serif text-wine break-words">{v}</p>
                    )
                  }
                />
              </div>
            )}

            {artwork.description && (
              <div className="border-t border-ink/10 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Description</p>
                <FieldWithHistory
                  dbField="description"
                  currentValue={artwork.description}
                  history={artwork.provenance_history}
                  renderValue={(v) => (
                    <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">{v}</p>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {artwork.creation_date && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Creation Date</p>
                  <FieldWithHistory
                    dbField="creation_date"
                    currentValue={artwork.creation_date}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">
                        {new Date(v).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  />
                </div>
              )}

              {artwork.medium && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Medium</p>
                  <FieldWithHistory
                    dbField="medium"
                    currentValue={artwork.medium}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {artwork.dimensions && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Dimensions</p>
                  <FieldWithHistory
                    dbField="dimensions"
                    currentValue={artwork.dimensions}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              <div className="border-t border-ink/10 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Date Certified</p>
                <p className="text-sm sm:text-base font-serif text-ink break-words">
                  {new Date(artwork.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {/* Certificate Creator */}
              {creatorInfo && creatorInfo.name && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">
                    {creatorInfo.role === 'gallery'
                      ? 'Uploaded by Gallery'
                      : creatorInfo.role === 'institution'
                        ? 'Uploaded by Institution'
                        : creatorInfo.role === 'curator'
                          ? 'Uploaded by Curator'
                          : 'Created by'}
                  </p>
                  <Link
                    href={creatorInfo.role === 'gallery' && creatorInfo.slug
                      ? `/g/${creatorInfo.slug}`
                      : (creatorInfo.role === 'gallery' || creatorInfo.role === 'institution') && creatorInfo.profileId
                      ? `/artists/${creatorInfo.accountId ?? artwork.account_id}?role=${creatorInfo.role}&profileId=${creatorInfo.profileId}`
                      : creatorInfo.role === 'gallery' || creatorInfo.role === 'institution'
                      ? `/artists/${creatorInfo.accountId ?? artwork.account_id}?role=${creatorInfo.role}`
                      : `/artists/${artwork.account_id}`}
                    className="text-sm sm:text-base font-serif text-wine break-words hover:text-wine/80 underline-offset-4 hover:underline"
                  >
                    {creatorInfo.name || 'Unknown'}
                  </Link>
                </div>
              )}

              {exhibitionList.length > 0 && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">
                    {exhibitionList.length > 1 ? `Exhibitions (${exhibitionList.length})` : 'Exhibition'}
                  </p>
                  <ul className="space-y-2">
                    {exhibitionList.map((ex) => (
                      <li key={ex.id}>
                        <Link
                          href={`/exhibitions/${ex.id}`}
                          className="text-sm sm:text-base font-serif text-wine break-words hover:text-wine/80 underline-offset-4 hover:underline"
                        >
                          {ex.title || 'Unknown Exhibition'}
                        </Link>
                        {ex.gallery?.name && ex.gallery.name !== ex.curator && (
                          <p className="text-xs text-ink/60 font-serif mt-0.5">{ex.gallery.name}</p>
                        )}
                        {ex.curator && (
                          <p className="text-xs text-ink/60 font-serif mt-0.5">
                            Curated by{' '}
                            {ex.curatorHref ? (
                              <Link
                                href={ex.curatorHref}
                                className="text-wine underline-offset-4 hover:underline"
                              >
                                {ex.curator}
                              </Link>
                            ) : (
                              <span className="text-ink/80">{ex.curator}</span>
                            )}
                          </p>
                        )}
                        {ex.start_date && (
                          <p className="text-xs text-ink/60 font-serif mt-0.5">
                            {formatExhibitionDate(ex.start_date)}
                            {ex.end_date && ` - ${formatExhibitionDate(ex.end_date)}`}
                          </p>
                        )}
                        {ex.location && (
                          <p className="text-xs text-ink/60 font-serif mt-0.5">{ex.location}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ArtworkPublications
                artworkId={artwork.id}
                publications={publications}
                canEdit={isOwner || canEditCertificate}
              />

              {artwork.metadata?.certificate_location?.formatted && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Certificate Created In</p>
                  <p className="text-sm sm:text-base font-serif text-ink break-words">
                    {artwork.metadata.certificate_location.formatted}
                  </p>
                </div>
              )}

              {artwork.edition && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Edition</p>
                  <FieldWithHistory
                    dbField="edition"
                    currentValue={artwork.edition}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {artwork.production_location && (
                <div className="border-t border-ink/10 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Production Location</p>
                  <FieldWithHistory
                    dbField="production_location"
                    currentValue={artwork.production_location}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* Provenance Valuation — gated on public || owner. Show CTA for owners even without an existing row. */}
              {SHOW_PROVENANCE_VALUATION &&
              ((valuation && (valuation.is_public || isOwner || canEditCertificate)) ||
                (!valuation && (isOwner || canRequestProvenance))) ? (
                <div className="pb-2">
                  <ProvenanceValuationBlock
                    artworkId={artwork.id}
                    valuation={valuation}
                    isOwner={isOwner || canEditCertificate}
                    canRequest={isOwner || canRequestProvenance}
                    variant="certificate"
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Provenance Information - Show if ANY provenance data exists */}
          {(artwork.former_owners || artwork.auction_history || artwork.exhibition_history || 
            artwork.historic_context || artwork.celebrity_notes ||
            artwork.value || provenanceValue || artwork.owned_by || artwork.sold_by ||
            linkedCertificates.length > 1 ||
            scanStats.total > 0 ||
            (canViewScanMap && scanLocations && scanLocations.length > 0)) && (
            <div className="border-t border-ink/10 pt-8 mt-8 sm:mt-10">
              <h2 className="text-lg sm:text-xl font-display font-semibold tracking-tight text-wine mb-5">
                Provenance
              </h2>

              {/* Certificates: every CoA / CoS / CoO issued for this work */}
              {linkedCertificates.length > 1 && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Certificates</p>
                  <ul className="space-y-1">
                    {linkedCertificates.map((cert) => {
                      const label = (
                        <>
                          {getCertificateTypeLabel(cert.certificateType)}
                          {cert.certificateNumber && <span className="text-ink/60"> {cert.certificateNumber}</span>}
                        </>
                      );
                      const issued = cert.issuedAt
                        ? new Date(cert.issuedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            timeZone: 'UTC',
                          })
                        : null;
                      return (
                        <li key={cert.id} className="text-sm sm:text-base font-serif text-ink break-words">
                          <span className="mr-2 inline-block rounded-full border border-ink/15 px-2 py-px text-[10px] font-serif uppercase tracking-wider text-ink/60 align-middle">
                            {SYNC_CERT_LABEL[cert.certificateType] ?? 'Cert'}
                          </span>
                          {cert.isCurrent ? (
                            label
                          ) : (
                            <Link href={`/artworks/${cert.id}/certificate`} className="underline decoration-wine/40 underline-offset-2 hover:text-wine">
                              {label}
                            </Link>
                          )}
                          {(cert.issuerName || issued) && (
                            <span className="text-ink/60">
                              {' · '}
                              {[cert.issuerName, issued].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {cert.isCurrent && <span className="ml-1 text-xs italic text-ink/50">(this certificate)</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Former Owners */}
              {artwork.former_owners && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Former Owners</p>
                  <FieldWithHistory
                    dbField="former_owners"
                    currentValue={artwork.former_owners}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* Value - show if it exists and (is public OR user is owner) */}
              {artwork.value && (artwork.value_is_public || isOwner) && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">
                    Value
                    {!artwork.value_is_public && isOwner && (
                      <span className="ml-2 normal-case tracking-normal text-ink/40 italic font-normal">(Private)</span>
                    )}
                  </p>
                  <FieldWithHistory
                    dbField="value"
                    currentValue={artwork.value}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">{v}</p>
                    )}
                  />
                </div>
              )}
              {provenanceValue && (artwork.value_is_public || isOwner) && (
                <ProvenanceValueLine value={provenanceValue} isPrivate={!artwork.value_is_public} variant="section" />
              )}

              {/* Owned By - show if it exists and (is public OR user is owner) */}
              {artwork.owned_by && (artwork.owned_by_is_public || isOwner) && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">
                    Owned By
                    {!artwork.owned_by_is_public && isOwner && (
                      <span className="ml-2 normal-case tracking-normal text-ink/40 italic font-normal">(Private)</span>
                    )}
                  </p>
                  <FieldWithHistory
                    dbField="owned_by"
                    currentValue={artwork.owned_by}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* Sold By - show if it exists and (is public OR user is owner) */}
              {artwork.sold_by && (artwork.sold_by_is_public || isOwner) && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">
                    Sold By
                    {!artwork.sold_by_is_public && isOwner && (
                      <span className="ml-2 normal-case tracking-normal text-ink/40 italic font-normal">(Private)</span>
                    )}
                  </p>
                  <FieldWithHistory
                    dbField="sold_by"
                    currentValue={artwork.sold_by}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* Auction History */}
              {artwork.auction_history && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Auction History</p>
                  <FieldWithHistory
                    dbField="auction_history"
                    currentValue={artwork.auction_history}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* Exhibition History */}
              {artwork.exhibition_history && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Exhibition History / Literature References</p>
                  <FieldWithHistory
                    dbField="exhibition_history"
                    currentValue={artwork.exhibition_history}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* Historic Context */}
              {artwork.historic_context && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Historic Context / Origin Information</p>
                  <FieldWithHistory
                    dbField="historic_context"
                    currentValue={artwork.historic_context}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* Celebrity Notes */}
              {artwork.celebrity_notes && (
                <div className="mb-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5">Special Notes on Celebrity or Notable Ownership</p>
                  <FieldWithHistory
                    dbField="celebrity_notes"
                    currentValue={artwork.celebrity_notes}
                    history={artwork.provenance_history}
                    renderValue={(v) => (
                      <p className="text-sm sm:text-base font-serif text-ink whitespace-pre-wrap break-words">{v}</p>
                    )}
                  />
                </div>
              )}

              {/* QR scan stats: counts for everyone */}
              {formatScanStats(scanStats) && (
                <div className="mb-3 sm:mb-4 flex items-start gap-2">
                  <Scan className="h-3.5 w-3.5 text-ink/40 mt-0.5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-ink/70 font-serif">
                    <span className="font-semibold text-ink">{formatScanStats(scanStats)}</span>
                    {scanStats.lastScannedAt &&
                      ` · last ${new Date(scanStats.lastScannedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}`}
                  </p>
                </div>
              )}

              {/* QR Code Scan Locations: owner and admins only */}
              {canViewScanMap && scanLocations && scanLocations.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Scan className="h-3.5 w-3.5 text-ink/40" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif">QR Code Scan Locations</p>
                  </div>
                  {canViewScanMap && scanLocationsWithCoordinates.length > 0 && (
                    <div className="mb-3">
                      <ScanLocationsMap locations={scanLocationsWithCoordinates} />
                    </div>
                  )}
                  <div className="space-y-2">
                    {scanLocations.map((scan, index) => {
                      // Build a human-readable location string, falling through from most
                      // precise (GPS) to IP-based approximation to "Location not shared".
                      const gpsLabel =
                        scan.formatted ||
                        [scan.city, scan.region, scan.country].filter(Boolean).join(', ') ||
                        (scan.latitude != null && scan.longitude != null
                          ? `${scan.latitude.toFixed(4)}, ${scan.longitude.toFixed(4)}`
                          : null);

                      const ipLabel =
                        [scan.ip_city, scan.ip_country].filter(Boolean).join(', ') || null;

                      const locationLabel = gpsLabel
                        ? gpsLabel
                        : ipLabel
                          ? `~${ipLabel} (approximate)`
                          : 'Location not shared';

                      const sourceTag =
                        scan.location_source === 'gps'
                          ? null
                          : scan.location_source === 'ip'
                            ? ' · IP estimate'
                            : ' · location denied';

                      return (
                        <div key={index} className="text-sm font-serif text-ink rounded-lg border border-ink/10 bg-parchment/40 px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 text-ink/40 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium mb-0.5 text-ink">
                                Scanned {new Date(scan.scanned_at).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                              <p className="text-ink/80">
                                {locationLabel}
                                {sourceTag && (
                                  <span className="text-ink/50 text-xs">{sourceTag}</span>
                                )}
                              </p>
                              {(isOwner || isAdmin) && scan.user_agent && (
                                <p className="text-ink/40 text-xs mt-1 truncate">{scan.user_agent}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Certificate attachments (photos & documents) */}
          {(() => {
            // Non-owners only see public attachments; owners and admins see all
            const visibleAttachments = (isOwner || isAdmin)
              ? attachments
              : attachments.filter((a) => a.is_public);
            if (visibleAttachments.length === 0) return null;
            return (
              <div className="border-t border-ink/10 pt-8 mt-8 sm:mt-10 print:break-inside-avoid">
                <h2 className="text-lg sm:text-xl font-display font-semibold tracking-tight text-wine mb-5">
                  Attachments
                </h2>
                <ul className="space-y-4">
                  {visibleAttachments.map((att) => (
                    <li key={att.id} className="rounded-lg border border-ink/10 bg-parchment/40 p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-display font-medium text-ink break-words">
                          {att.label ?? att.file_name}
                        </p>
                        {(isOwner || isAdmin) && !att.is_public && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-serif text-ink/60">
                            Private
                          </span>
                        )}
                      </div>
                      {att.label && att.label !== att.file_name && (
                        <p className="text-xs text-ink/50 font-serif mb-2 break-all">{att.file_name}</p>
                      )}
                      {att.file_type === 'image' ? (
                        <div className="relative mx-auto max-w-full">
                          <Image
                            src={att.file_url}
                            alt={att.label ?? att.file_name}
                            width={800}
                            height={600}
                            className="max-h-96 w-auto max-w-full object-contain"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-xs sm:text-sm font-serif text-ink hover:bg-accent transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Open PDF
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* Authentication Statement */}
          <div className="border-t border-ink/10 pt-8 mt-8 sm:mt-10">
            <p className="text-sm font-serif text-ink/75 leading-relaxed mb-3 break-words">
              This certifies that the artwork described above has been registered in the
              Provenance registry
              {isOwner ? (
                <> and assigned the certificate number{' '}
                <span className="font-semibold text-wine break-all">{artwork.certificate_number}</span>.
                </>
              ) : (
                '.'
              )}
              {' '}This certificate serves as a record of authenticity and provenance for the
              artwork.
            </p>
            {isOwner && (
              <p className="text-xs text-ink/50 font-serif break-words">
                This certificate is issued by Provenance and can be verified using the
                certificate number above.
              </p>
            )}
          </div>

          {/* Request Update and Edit Buttons (for non-owners) */}
          {!isOwner && user.data && (
            <div className="mt-8 pt-6 border-t border-ink/10 text-center print:hidden">
              <div className="flex flex-wrap gap-2 justify-center">
                {(certificateType === CERTIFICATE_TYPES.SHOW || certificateType === CERTIFICATE_TYPES.OWNERSHIP) && canClaimAsArtist && (
                  <ClaimAsArtistDialog artworkId={artwork.id} />
                )}
                <EditArtworkDialog 
                  artwork={artwork} 
                  isCreator={canEditCertificate}
                  exhibition={exhibition}
                  creatorInfo={creatorInfo}
                  certificateType={certificateType}
                />
                <RequestUpdateDialog artwork={artwork} />
              </div>
            </div>
          )}

          {/* Issue a Certificate of Ownership (Edit lives in the toolbar) */}
          {canIssueOwnership && user.data && (
            <div className="mt-8 pt-6 border-t border-ink/10 text-center print:hidden">
              <div className="flex flex-wrap gap-2 justify-center">
                {canIssueOwnership && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-serif text-xs sm:text-sm gap-1.5"
                    onClick={() => setIssueCooOpen(true)}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Issue Certificate of Ownership
                  </Button>
                )}
              </div>
              {canIssueOwnership && <PendingCooInviteStatus artworkId={artwork.id} />}
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 sm:mt-12 text-center">
            <p className="text-[11px] tracking-wide text-ink/40 font-serif">
              Provenance | Verified provenance entries and immutable historical timelines
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

