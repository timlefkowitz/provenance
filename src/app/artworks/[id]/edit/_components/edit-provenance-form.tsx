'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { cn } from '@kit/ui/utils';
import { useCurrentUser } from '~/hooks/use-current-user';
import { updateProvenance } from '../_actions/update-provenance';
import { GallerySelector } from './gallery-selector';
import { ExhibitionSelector } from './exhibition-selector';
import { ArtworkTextTypeahead } from '~/components/artwork-text-typeahead';
import { sendArtistClaimInvite } from '../../certificate/_actions/send-artist-claim-invite';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import {
  FIELD_LABEL,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FIELD_HINT,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FieldSection,
} from '~/components/editorial-form';

type Artwork = {
  id: string;
  title: string;
  description: string | null;
  artist_name: string | null;
  medium: string | null;
  certificate_type: string | null;
  creation_date: string | null;
  dimensions: string | null;
  former_owners: string | null;
  auction_history: string | null;
  exhibition_history: string | null;
  historic_context: string | null;
  celebrity_notes: string | null;
  is_public: boolean | null;
  value: string | null;
  value_is_public: boolean | null;
  edition: string | null;
  production_location: string | null;
  owned_by: string | null;
  owned_by_is_public: boolean | null;
  sold_by: string | null;
  sold_by_is_public: boolean | null;
};

const SWITCH = 'data-[state=checked]:bg-editorial-ink data-[state=unchecked]:bg-editorial-ink/15';

/** Hairline row with a mono label, a short hint and a switch on the right. */
function PrivacyToggle({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-editorial-border/15 pt-3">
      <div className="space-y-1">
        <Label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </Label>
        <p className={FIELD_HINT}>{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className={SWITCH} />
    </div>
  );
}

export function EditProvenanceForm({
  artwork,
  currentExhibitionId,
}: {
  artwork: Artwork;
  currentExhibitionId?: string | null;
}) {
  const router = useRouter();
  const user = useCurrentUser();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [invitePending, startInviteTransition] = useTransition();
  const [formData, setFormData] = useState({
    title: artwork.title || '',
    description: artwork.description || '',
    artist_name: artwork.artist_name || '',
    medium: artwork.medium || '',
    artistInviteEmail: '',
    creationDate: artwork.creation_date || '',
    dimensions: artwork.dimensions || '',
    formerOwners: artwork.former_owners || '',
    auctionHistory: artwork.auction_history || '',
    exhibitionHistory: artwork.exhibition_history || '',
    historicContext: artwork.historic_context || '',
    celebrityNotes: artwork.celebrity_notes || '',
    isPublic: artwork.is_public ?? true, // Default to true if null
    value: artwork.value || '',
    valueIsPublic: artwork.value_is_public ?? false, // Default to false (private)
    edition: artwork.edition || '',
    productionLocation: artwork.production_location || '',
    ownedBy: artwork.owned_by || '',
    ownedByIsPublic: artwork.owned_by_is_public ?? false, // Default to false (private)
    soldBy: artwork.sold_by || '',
    soldByIsPublic: artwork.sold_by_is_public ?? false, // Default to false (private)
    exhibitionId: currentExhibitionId || null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate title is not empty
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateProvenance(artwork.id, formData);

        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push(`/artworks/${artwork.id}/certificate`);
          }, 1500);
        }
      } catch (e) {
        console.error('[EditProvenanceForm] Submit failed', e);
        setError('Something went wrong. Please try again.');
      }
    });
  };

  const canSendArtistInvite =
    artwork.certificate_type === CERTIFICATE_TYPES.SHOW ||
    artwork.certificate_type === CERTIFICATE_TYPES.OWNERSHIP;

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      {(error || success || inviteError || inviteSuccess) && (
        <div className="space-y-3">
          {error && (
            <Alert variant="destructive" className="rounded-none">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="rounded-none border-editorial-border/30 bg-cream/60">
              <AlertTitle className="font-jetbrains text-[11px] uppercase tracking-[0.18em]">
                Saved
              </AlertTitle>
              <AlertDescription className="font-serif">
                Certificate updated. Taking you back to it…
              </AlertDescription>
            </Alert>
          )}

          {inviteError && (
            <Alert variant="destructive" className="rounded-none">
              <AlertTitle>Invite failed</AlertTitle>
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          )}

          {inviteSuccess && (
            <Alert className="rounded-none border-editorial-border/30 bg-cream/60">
              <AlertTitle className="font-jetbrains text-[11px] uppercase tracking-[0.18em]">
                Invite sent
              </AlertTitle>
              <AlertDescription className="font-serif">{inviteSuccess}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* 01 — The work */}
      <section className="space-y-7">
        <FieldSection index="01" title="The work" />

        <div className="space-y-2">
          <Label htmlFor="title" className={FIELD_LABEL}>Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Artwork title"
            className={FIELD_INPUT}
            required
          />
        </div>

        <div className="grid gap-7 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="artistName" className={FIELD_LABEL}>Artist</Label>
            <Input
              id="artistName"
              value={formData.artist_name}
              onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
              placeholder="Artist name"
              className={FIELD_INPUT}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medium" className={FIELD_LABEL}>Medium</Label>
            <ArtworkTextTypeahead
              id="medium"
              value={formData.medium}
              onChange={(next) => setFormData({ ...formData, medium: next })}
              placeholder="e.g., Oil on canvas"
              className={FIELD_INPUT}
              userId={user.data?.id}
              field="medium"
            />
          </div>
        </div>

        {canSendArtistInvite && (
          <div className="space-y-2">
            <Label htmlFor="artistInviteEmail" className={FIELD_LABEL}>Artist email</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                id="artistInviteEmail"
                type="email"
                autoComplete="email"
                value={formData.artistInviteEmail}
                onChange={(e) =>
                  setFormData({ ...formData, artistInviteEmail: e.target.value })
                }
                placeholder="artist@example.com"
                className={FIELD_INPUT}
              />
              <Button
                type="button"
                variant="outline"
                className={cn(BUTTON_SECONDARY, 'shrink-0')}
                disabled={invitePending || !formData.artistInviteEmail.trim()}
                onClick={() => {
                  setInviteError(null);
                  setInviteSuccess(null);
                  startInviteTransition(async () => {
                    console.log('[EditProvenanceForm] sendArtistClaimInvite started', {
                      artworkId: artwork.id,
                    });
                    const result = await sendArtistClaimInvite(
                      artwork.id,
                      formData.artistInviteEmail,
                    );
                    if (!result.success) {
                      setInviteError(result.error || 'Failed to send artist invite');
                      return;
                    }
                    setInviteSuccess(
                      'Claim email sent. The artist can use it to claim and create linked Certificates of Authenticity.',
                    );
                    setFormData((prev) => ({ ...prev, artistInviteEmail: '' }));
                  });
                }}
              >
                {invitePending ? 'Sending…' : 'Send claim invite'}
              </Button>
            </div>
            <p className={FIELD_HINT}>
              Sends a secure claim link to the artist. They sign in with that email to claim.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description" className={FIELD_LABEL}>Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the work, its history and any notable features…"
            rows={5}
            className={FIELD_TEXTAREA}
          />
        </div>

        <div className="grid gap-7 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="creationDate" className={FIELD_LABEL}>Creation date</Label>
            <Input
              id="creationDate"
              type="date"
              value={formData.creationDate}
              onChange={(e) => setFormData({ ...formData, creationDate: e.target.value })}
              className={FIELD_INPUT}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dimensions" className={FIELD_LABEL}>Dimensions</Label>
            <Input
              id="dimensions"
              value={formData.dimensions}
              onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
              placeholder="e.g., 24 x 36 in"
              className={FIELD_INPUT}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edition" className={FIELD_LABEL}>Edition</Label>
            <Input
              id="edition"
              value={formData.edition}
              onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
              placeholder="e.g., 1/10, Unique, AP"
              className={FIELD_INPUT}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productionLocation" className={FIELD_LABEL}>Production location</Label>
            <ArtworkTextTypeahead
              id="productionLocation"
              value={formData.productionLocation}
              onChange={(next) => setFormData({ ...formData, productionLocation: next })}
              placeholder="e.g., Paris, France"
              className={FIELD_INPUT}
              userId={user.data?.id}
              field="production_location"
            />
          </div>
        </div>
      </section>

      {/* 02 — Value & ownership */}
      <section className="space-y-7">
        <FieldSection index="02" title="Value & ownership" />

        <div className="space-y-3">
          <Label htmlFor="value" className={FIELD_LABEL}>Value</Label>
          <Input
            id="value"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            placeholder="e.g., $50,000 USD"
            className={FIELD_INPUT}
          />
          <PrivacyToggle
            id="valueIsPublic"
            label="Make value public"
            hint="Private by default: only you can see it."
            checked={formData.valueIsPublic}
            onCheckedChange={(checked) => setFormData({ ...formData, valueIsPublic: checked })}
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="ownedBy" className={FIELD_LABEL}>Owned by</Label>
          <ArtworkTextTypeahead
            id="ownedBy"
            value={formData.ownedBy}
            onChange={(next) => setFormData({ ...formData, ownedBy: next })}
            placeholder="Current owner or collection"
            className={FIELD_INPUT}
            userId={user.data?.id}
            field="owned_by"
          />
          <PrivacyToggle
            id="ownedByIsPublic"
            label="Make ownership public"
            hint="Private by default: only you can see it."
            checked={formData.ownedByIsPublic}
            onCheckedChange={(checked) => setFormData({ ...formData, ownedByIsPublic: checked })}
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="soldBy" className={FIELD_LABEL}>Sold by</Label>
          <ArtworkTextTypeahead
            id="soldBy"
            value={formData.soldBy}
            onChange={(next) => setFormData({ ...formData, soldBy: next })}
            placeholder="Gallery, dealer or seller"
            className={FIELD_INPUT}
            userId={user.data?.id}
            field="sold_by"
          />
          <PrivacyToggle
            id="soldByIsPublic"
            label="Make seller public"
            hint="Private by default: only you can see it."
            checked={formData.soldByIsPublic}
            onCheckedChange={(checked) => setFormData({ ...formData, soldByIsPublic: checked })}
          />
        </div>
      </section>

      {/* 03 — Provenance */}
      <section className="space-y-7">
        <FieldSection index="03" title="Provenance" />

        <div className="space-y-2">
          <Label htmlFor="formerOwners" className={FIELD_LABEL}>Former owners</Label>
          <ArtworkTextTypeahead
            id="formerOwners"
            value={formData.formerOwners}
            onChange={(next) => setFormData({ ...formData, formerOwners: next })}
            placeholder="Collectors, estates, galleries or institutions that held the work (e.g., Estate of John Smith, 1950–1975)"
            kind="textarea"
            rows={4}
            className={FIELD_TEXTAREA}
            userId={user.data?.id}
            field="former_owners"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auctionHistory" className={FIELD_LABEL}>Auction history</Label>
          <Textarea
            id="auctionHistory"
            value={formData.auctionHistory}
            onChange={(e) => setFormData({ ...formData, auctionHistory: e.target.value })}
            placeholder="Previous sales with dates and lot numbers (e.g., Sotheby's, New York, May 15, 2010, Lot 45)"
            rows={4}
            className={FIELD_TEXTAREA}
          />
        </div>

        {user.data && (
          <ExhibitionSelector
            value={formData.exhibitionId}
            onChange={(exhibitionId) => setFormData({ ...formData, exhibitionId })}
            userId={user.data.id}
            currentExhibitionId={currentExhibitionId}
            editorial
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="exhibitionHistory" className={FIELD_LABEL}>
            Exhibition history / literature
          </Label>
          <GallerySelector
            value={formData.exhibitionHistory}
            onChange={(value) => setFormData({ ...formData, exhibitionHistory: value })}
            inputClassName={cn(FIELD_INPUT, 'pl-7')}
          />
          <Textarea
            id="exhibitionHistory"
            value={formData.exhibitionHistory}
            onChange={(e) => setFormData({ ...formData, exhibitionHistory: e.target.value })}
            placeholder="Exhibitions where the work was shown or publications that discuss it. You can also search galleries above."
            rows={4}
            className={FIELD_TEXTAREA}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="historicContext" className={FIELD_LABEL}>Historic context / origin</Label>
          <Textarea
            id="historicContext"
            value={formData.historicContext}
            onChange={(e) => setFormData({ ...formData, historicContext: e.target.value })}
            placeholder="How and where the work was first acquired (e.g., Acquired from the artist's studio in Paris, 1925)"
            rows={4}
            className={FIELD_TEXTAREA}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="celebrityNotes" className={FIELD_LABEL}>Notable ownership</Label>
          <Textarea
            id="celebrityNotes"
            value={formData.celebrityNotes}
            onChange={(e) => setFormData({ ...formData, celebrityNotes: e.target.value })}
            placeholder="Any association with famous figures or important collections"
            rows={4}
            className={FIELD_TEXTAREA}
          />
        </div>
      </section>

      {/* 04 — Visibility */}
      <section className="space-y-5">
        <FieldSection index="04" title="Visibility" />
        <PrivacyToggle
          id="isPublic"
          label="Make artwork public"
          hint="Public artworks are visible to everyone. Private artworks are only visible to you."
          checked={formData.isPublic}
          onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
        />
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t border-editorial-border/50 bg-bone/95 px-4 py-4 backdrop-blur-sm pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/artworks/${artwork.id}/certificate`)}
          disabled={pending}
          className={BUTTON_SECONDARY}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className={cn(BUTTON_PRIMARY, 'group hover:bg-vermillion')}
        >
          {pending ? 'Saving…' : 'Save changes'}
          {!pending && (
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          )}
        </Button>
      </div>
    </form>
  );
}
