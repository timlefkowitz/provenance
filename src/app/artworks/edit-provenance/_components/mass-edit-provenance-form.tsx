'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { batchUpdateProvenance } from '../_actions/batch-update-provenance';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  creation_date: string | null;
  medium: string | null;
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

export function MassEditProvenanceForm({ artworks }: { artworks: Artwork[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    // Basic fields
    artist_name: '',
    description: '',
    creation_date: '',
    medium: '',
    dimensions: '',
    
    // Provenance fields
    former_owners: '',
    auction_history: '',
    exhibition_history: '',
    historic_context: '',
    celebrity_notes: '',
    
    // Value and ownership
    value: '',
    edition: '',
    production_location: '',
    owned_by: '',
    sold_by: '',
    
    // Privacy toggles
    is_public: undefined as boolean | undefined,
    value_is_public: undefined as boolean | undefined,
    owned_by_is_public: undefined as boolean | undefined,
    sold_by_is_public: undefined as boolean | undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Build update object with only fields that have values
    const updates: any = {};
    
    if (formData.artist_name.trim()) updates.artist_name = formData.artist_name.trim();
    if (formData.description.trim()) updates.description = formData.description.trim();
    if (formData.creation_date.trim()) updates.creationDate = formData.creation_date.trim();
    if (formData.medium.trim()) updates.medium = formData.medium.trim();
    if (formData.dimensions.trim()) updates.dimensions = formData.dimensions.trim();
    if (formData.former_owners.trim()) updates.formerOwners = formData.former_owners.trim();
    if (formData.auction_history.trim()) updates.auctionHistory = formData.auction_history.trim();
    if (formData.exhibition_history.trim()) updates.exhibitionHistory = formData.exhibition_history.trim();
    if (formData.historic_context.trim()) updates.historicContext = formData.historic_context.trim();
    if (formData.celebrity_notes.trim()) updates.celebrityNotes = formData.celebrity_notes.trim();
    if (formData.value.trim()) updates.value = formData.value.trim();
    if (formData.edition.trim()) updates.edition = formData.edition.trim();
    if (formData.production_location.trim()) updates.productionLocation = formData.production_location.trim();
    if (formData.owned_by.trim()) updates.ownedBy = formData.owned_by.trim();
    if (formData.sold_by.trim()) updates.soldBy = formData.sold_by.trim();
    
    // Privacy toggles - only include if explicitly set
    if (formData.is_public !== undefined) updates.isPublic = formData.is_public;
    if (formData.value_is_public !== undefined) updates.valueIsPublic = formData.value_is_public;
    if (formData.owned_by_is_public !== undefined) updates.ownedByIsPublic = formData.owned_by_is_public;
    if (formData.sold_by_is_public !== undefined) updates.soldByIsPublic = formData.sold_by_is_public;

    if (Object.keys(updates).length === 0) {
      setError('Please fill in at least one field to update');
      return;
    }

    const artworkIds = artworks.map(a => a.id);

    startTransition(async () => {
      try {
        const result = await batchUpdateProvenance(artworkIds, updates);
        
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push('/artworks/my');
          }, 2000);
        }
      } catch (e) {
        setError('Something went wrong. Please try again.');
        console.error(e);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            Successfully updated provenance for {artworks.length} {artworks.length === 1 ? 'artwork' : 'artworks'}! Redirecting...
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Basic Information */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="artist_name" className="font-serif">Artist Name</Label>
              <Input
                id="artist_name"
                value={formData.artist_name}
                onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                placeholder="Leave empty to keep existing values"
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="description" className="font-serif">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Leave empty to keep existing values"
                className="font-serif"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="creation_date" className="font-serif">Creation Date</Label>
                <Input
                  id="creation_date"
                  type="date"
                  value={formData.creation_date}
                  onChange={(e) => setFormData({ ...formData, creation_date: e.target.value })}
                  className="font-serif"
                />
              </div>

              <div>
                <Label htmlFor="medium" className="font-serif">Medium</Label>
                <Input
                  id="medium"
                  value={formData.medium}
                  onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                  placeholder="e.g., Oil on Canvas"
                  className="font-serif"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dimensions" className="font-serif">Dimensions</Label>
              <Input
                id="dimensions"
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                placeholder="e.g., 24 x 36 inches"
                className="font-serif"
              />
            </div>
          </CardContent>
        </Card>

        {/* Provenance History */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">Provenance History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="former_owners" className="font-serif">Former Owners</Label>
              <Textarea
                id="former_owners"
                value={formData.former_owners}
                onChange={(e) => setFormData({ ...formData, former_owners: e.target.value })}
                placeholder="Names of former owners, collectors, galleries, or institutions"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="auction_history" className="font-serif">Auction History</Label>
              <Textarea
                id="auction_history"
                value={formData.auction_history}
                onChange={(e) => setFormData({ ...formData, auction_history: e.target.value })}
                placeholder="Records of previous sales at auction houses (including dates and lot numbers)"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="exhibition_history" className="font-serif">Exhibition History</Label>
              <Textarea
                id="exhibition_history"
                value={formData.exhibition_history}
                onChange={(e) => setFormData({ ...formData, exhibition_history: e.target.value })}
                placeholder="Exhibition history or literature references where the work has been discussed"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="historic_context" className="font-serif">Historic Context</Label>
              <Textarea
                id="historic_context"
                value={formData.historic_context}
                onChange={(e) => setFormData({ ...formData, historic_context: e.target.value })}
                placeholder="Historic context / origin information: how and where it was acquired originally"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="celebrity_notes" className="font-serif">Celebrity Notes</Label>
              <Textarea
                id="celebrity_notes"
                value={formData.celebrity_notes}
                onChange={(e) => setFormData({ ...formData, celebrity_notes: e.target.value })}
                placeholder="Special notes on celebrity or notable ownership"
                className="font-serif"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Value & Ownership */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">Value & Ownership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value" className="font-serif">Value</Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="e.g., $10,000"
                  className="font-serif"
                />
              </div>

              <div>
                <Label htmlFor="edition" className="font-serif">Edition</Label>
                <Input
                  id="edition"
                  value={formData.edition}
                  onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                  placeholder="e.g., 1/10"
                  className="font-serif"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="production_location" className="font-serif">Production Location</Label>
              <Input
                id="production_location"
                value={formData.production_location}
                onChange={(e) => setFormData({ ...formData, production_location: e.target.value })}
                placeholder="Where the artwork was created"
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="owned_by" className="font-serif">Owned By</Label>
              <Input
                id="owned_by"
                value={formData.owned_by}
                onChange={(e) => setFormData({ ...formData, owned_by: e.target.value })}
                placeholder="Current owner name"
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor="sold_by" className="font-serif">Sold By</Label>
              <Input
                id="sold_by"
                value={formData.sold_by}
                onChange={(e) => setFormData({ ...formData, sold_by: e.target.value })}
                placeholder="Gallery or seller name"
                className="font-serif"
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">Privacy Settings</CardTitle>
            <p className="text-sm text-ink/60 font-serif mt-2">
              Toggle to change privacy settings. Leave unchecked to keep existing settings.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_public" className="font-serif">Make Artwork Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show this artwork in public galleries
                </p>
              </div>
              <Switch
                id="is_public"
                checked={formData.is_public ?? false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="value_is_public" className="font-serif">Make Value Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show value information publicly
                </p>
              </div>
              <Switch
                id="value_is_public"
                checked={formData.value_is_public ?? false}
                onCheckedChange={(checked) => setFormData({ ...formData, value_is_public: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="owned_by_is_public" className="font-serif">Make Owner Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show owner information publicly
                </p>
              </div>
              <Switch
                id="owned_by_is_public"
                checked={formData.owned_by_is_public ?? false}
                onCheckedChange={(checked) => setFormData({ ...formData, owned_by_is_public: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sold_by_is_public" className="font-serif">Make Seller Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show seller information publicly
                </p>
              </div>
              <Switch
                id="sold_by_is_public"
                checked={formData.sold_by_is_public ?? false}
                onCheckedChange={(checked) => setFormData({ ...formData, sold_by_is_public: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Selected Artworks Summary */}
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">
              Selected Artworks ({artworks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {artworks.map((artwork) => (
                <div key={artwork.id} className="text-sm font-serif text-ink/70">
                  • {artwork.title} {artwork.artist_name && `by ${artwork.artist_name}`}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/artworks/my')}
            disabled={pending}
            className="font-serif"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            {pending ? 'Updating...' : `Update ${artworks.length} ${artworks.length === 1 ? 'Artwork' : 'Artworks'}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
