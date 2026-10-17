'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { toast } from '@kit/ui/sonner';
import { createExhibition } from '../_actions/create-exhibition';
import { updateExhibition } from '../_actions/update-exhibition';
import { createQuickExhibitionListings } from '../_actions/create-exhibition-listings';
import { ParticipantSelector, type ExhibitionArtistInvite } from './participant-selector';
import { ChecklistImport, type ChecklistRow } from './checklist-import';
import type { ExhibitionChecklist } from '../_helpers/checklist-parsing';
import type { ExhibitionOwnerRole } from '../_helpers/exhibition-owner-roles';
import { getRoleLabel } from '~/lib/user-roles';
import { cn } from '@kit/ui/utils';
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
} from '~/components/editorial-form';

import { asUntyped } from '~/lib/supabase-untyped';
type Artist = {
  id: string;
  name: string;
  picture_url: string | null;
};

const OWNER_ROLE_HINTS: Partial<Record<ExhibitionOwnerRole, string>> = {
  gallery: 'Listed under your gallery. Invited artists get a Certificate of Authenticity and your gallery gets a linked Certificate of Show.',
  institution: 'Listed under your institution. Invited artists get a Certificate of Authenticity and your institution gets a linked Certificate of Show.',
  artist: 'Listed on your artist profile, separate from any gallery you run. Invited artists keep their own Certificates of Authenticity.',
};

export function ExhibitionForm({
  exhibition,
  ownerRoleOptions = [],
  defaultOwnerRole,
}: {
  exhibition?: any;
  /** Modes the new exhibition can be created under; ignored when editing. */
  ownerRoleOptions?: ExhibitionOwnerRole[];
  defaultOwnerRole?: ExhibitionOwnerRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Initialize selected artists and metadata from exhibition if editing
  const initialArtists = (exhibition as any)?.artists || [];
  const initialMetadata = (exhibition as any)?.metadata || {};
  
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>(initialArtists);
  const [selectedInvites, setSelectedInvites] = useState<ExhibitionArtistInvite[]>([]);
  const [checklistRows, setChecklistRows] = useState<ChecklistRow[]>([]);
  const [ownerRole, setOwnerRole] = useState<ExhibitionOwnerRole | undefined>(defaultOwnerRole);

  const [formData, setFormData] = useState({
    title: exhibition?.title || '',
    description: exhibition?.description || '',
    startDate: exhibition?.start_date
      ? new Date(exhibition.start_date).toISOString().split('T')[0]
      : '',
    endDate: exhibition?.end_date
      ? new Date(exhibition.end_date).toISOString().split('T')[0]
      : '',
    location: exhibition?.location || '',
    curator: initialMetadata.curator || '',
    theme: initialMetadata.theme || '',
    maxArtworksPerArtist: initialMetadata.max_artworks_per_artist
      ? String(initialMetadata.max_artworks_per_artist)
      : '',
  });

  // Only fill fields the user hasn't typed into yet.
  const handleChecklistExtracted = (checklist: ExhibitionChecklist) => {
    setFormData((prev) => ({
      ...prev,
      title: prev.title || checklist.exhibitionTitle,
      startDate: prev.startDate || checklist.startDate,
      endDate: prev.endDate || checklist.endDate,
      location: prev.location || checklist.location,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.startDate) {
      setError('Title and start date are required');
      return;
    }

    startTransition(async () => {
      try {
        const formDataObj = new FormData();
        formDataObj.append('title', formData.title);
        formDataObj.append('description', formData.description);
        formDataObj.append('startDate', formData.startDate);
        formDataObj.append('endDate', formData.endDate || '');
        formDataObj.append('location', formData.location);
        formDataObj.append('curator', formData.curator);
        formDataObj.append('theme', formData.theme);
        formDataObj.append('maxArtworksPerArtist', formData.maxArtworksPerArtist);
        if (!exhibition && ownerRole) {
          formDataObj.append('ownerRole', ownerRole);
        }
        // Append artist IDs as JSON array
        formDataObj.append('artistIds', JSON.stringify(selectedArtists.map(a => a.id)));
        formDataObj.append(
          'artistInvites',
          JSON.stringify(
            selectedInvites.map(({ email, name, artistAccountId }) => ({
              email,
              name,
              artistAccountId: artistAccountId ?? null,
            })),
          ),
        );

        if (exhibition) {
          await updateExhibition(exhibition.id, formDataObj);
          toast.success('Exhibition updated successfully');
          router.push(`/exhibitions/${exhibition.id}/edit#artworks`);
        } else {
          const result = await createExhibition(formDataObj);
          const checklistItems = checklistRows.filter((r) => r.title.trim());
          if (result?.exhibitionId && checklistItems.length > 0) {
            const listingsFd = new FormData();
            listingsFd.append('exhibitionId', result.exhibitionId);
            listingsFd.append(
              'items',
              JSON.stringify(
                checklistItems.map(({ key, title, artistName, price, dimensions }) => ({
                  key,
                  title,
                  artistName,
                  price,
                  dimensions,
                })),
              ),
            );
            const listings = await createQuickExhibitionListings(listingsFd);
            if (listings.success) {
              toast.success(`Exhibition created with ${listings.created} artwork${listings.created === 1 ? '' : 's'}.`);
            } else {
              console.error('[ExhibitionForm] Checklist listings failed', listings.error);
              toast.error(`Exhibition created, but artworks could not be added: ${listings.error}`);
            }
          } else {
            toast.success('Exhibition created. Add artworks below.');
          }
          if (result?.exhibitionId) {
            router.push(`/exhibitions/${result.exhibitionId}/edit#artworks`);
          } else {
            router.push(ownerRole ? `/exhibitions?as=${ownerRole}` : '/exhibitions');
          }
        }

        router.refresh();
      } catch (e) {
        console.error('[ExhibitionForm] Error saving exhibition', e);
        const errorMessage = (e instanceof Error && e.message) || 'Failed to save exhibition';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!exhibition && ownerRoleOptions.length > 1 && ownerRole && (
        <fieldset className="space-y-2">
          <legend className={FIELD_LABEL}>Create as</legend>
          <div className="inline-flex border border-editorial-border/30 p-1 font-jetbrains text-[11px] uppercase tracking-[0.16em]">
            {ownerRoleOptions.map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={role === ownerRole}
                onClick={() => setOwnerRole(role)}
                className={cn(
                  'rounded-none px-4 py-1.5 transition-colors',
                  role === ownerRole ? 'bg-editorial-ink text-bone' : 'text-editorial-ink/60 hover:text-editorial-ink',
                )}
              >
                {getRoleLabel(role)}
              </button>
            ))}
          </div>
          {OWNER_ROLE_HINTS[ownerRole] && (
            <p className={FIELD_HINT}>{OWNER_ROLE_HINTS[ownerRole]}</p>
          )}
        </fieldset>
      )}

      {!exhibition && (
        <ChecklistImport
          rows={checklistRows}
          onRowsChange={setChecklistRows}
          onExtracted={handleChecklistExtracted}
        />
      )}

      <div className="space-y-7">
        <div className="space-y-2">
          <Label htmlFor="title" className={FIELD_LABEL}>Exhibition Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="e.g., Spring Collection 2024"
            className={FIELD_INPUT}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className={FIELD_LABEL}>Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Describe the exhibition..."
            rows={4}
            className={FIELD_TEXTAREA}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          <div className="space-y-2">
            <Label htmlFor="startDate" className={FIELD_LABEL}>Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className={FIELD_INPUT}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate" className={FIELD_LABEL}>End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData({ ...formData, endDate: e.target.value })
              }
              className={FIELD_INPUT}
              min={formData.startDate}
            />
            <p className={FIELD_HINT}>
              Leave empty for ongoing exhibitions
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className={FIELD_LABEL}>Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            placeholder="e.g., Gallery Name, City, Country"
            className={FIELD_INPUT}
          />
        </div>

        <ParticipantSelector
          selectedArtists={selectedArtists}
          onArtistsChange={setSelectedArtists}
          selectedInvites={selectedInvites}
          onInvitesChange={setSelectedInvites}
        />

        <div className="space-y-2">
          <Label htmlFor="maxArtworksPerArtist" className={FIELD_LABEL}>Artworks each artist can upload</Label>
          <select
            id="maxArtworksPerArtist"
            value={formData.maxArtworksPerArtist}
            onChange={(e) =>
              setFormData({ ...formData, maxArtworksPerArtist: e.target.value })
            }
            className={cn(FIELD_INPUT, 'flex w-56 focus-visible:outline-none')}
          >
            <option value="">No limit</option>
            {[
              ...new Set([
                ...Array.from({ length: 20 }, (_, i) => i + 1),
                ...(formData.maxArtworksPerArtist ? [Number(formData.maxArtworksPerArtist)] : []),
              ]),
            ]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={String(n)}>
                  Up to {n} {n === 1 ? 'artwork' : 'artworks'}
                </option>
              ))}
          </select>
          <p className={FIELD_HINT}>
            Applies to new invites and your open call. Artists submit up to this many works
            for you to select from; you can change it per artist once invites are sent.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="curator" className={FIELD_LABEL}>Curator</Label>
          <Input
            id="curator"
            value={formData.curator}
            onChange={(e) =>
              setFormData({ ...formData, curator: e.target.value })
            }
            placeholder="e.g., Jane Smith"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme" className={FIELD_LABEL}>Theme</Label>
          <Input
            id="theme"
            value={formData.theme}
            onChange={(e) =>
              setFormData({ ...formData, theme: e.target.value })
            }
            placeholder="e.g., Abstract Expressionism, Contemporary Portraits"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={pending}
          className={cn(BUTTON_PRIMARY, 'hover:bg-vermillion')}
        >
          {pending
            ? 'Saving...'
            : exhibition
              ? 'Update Exhibition'
              : 'Create Exhibition'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className={BUTTON_SECONDARY}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

