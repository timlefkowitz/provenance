'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { updateProvenance } from '../_actions/update-provenance';
import { GallerySelector } from './gallery-selector';

type Artwork = {
  id: string;
  title: string;
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

export function EditProvenanceForm({ artwork }: { artwork: Artwork }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: artwork.title || '',
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
        setError('Something went wrong. Please try again.');
        console.error(e);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            Provenance information updated successfully! Redirecting to certificate...
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Artwork title"
            className="font-serif"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="creationDate">Creation Date</Label>
          <Input
            id="creationDate"
            type="date"
            value={formData.creationDate}
            onChange={(e) => setFormData({ ...formData, creationDate: e.target.value })}
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dimensions">Dimensions</Label>
          <Input
            id="dimensions"
            value={formData.dimensions}
            onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
            placeholder="e.g., 24 x 36 inches"
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="formerOwners">Former Owners</Label>
          <Textarea
            id="formerOwners"
            value={formData.formerOwners}
            onChange={(e) => setFormData({ ...formData, formerOwners: e.target.value })}
            placeholder="List prominent collectors, estates, galleries, or institutions that previously held the work (e.g., Estate of John Smith, 1950-1975; Gallery XYZ, 1975-1980)"
            rows={4}
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">Value</Label>
          <div className="space-y-2">
            <Input
              id="value"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="e.g., $50,000 USD"
              className="font-serif"
            />
            <div className="flex items-center justify-between p-3 border border-wine/20 rounded-lg bg-parchment/50">
              <div className="space-y-0.5">
                <Label htmlFor="valueIsPublic" className="text-sm font-serif">
                  Make value public
                </Label>
                <p className="text-xs text-ink/60 font-serif">
                  By default, value is private and only visible to you.
                </p>
              </div>
              <Switch
                id="valueIsPublic"
                checked={formData.valueIsPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, valueIsPublic: checked })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edition">Edition</Label>
          <Input
            id="edition"
            value={formData.edition}
            onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
            placeholder="e.g., 1/10, Limited Edition, Unique, AP (Artist's Proof)"
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="productionLocation">Production Location</Label>
          <Input
            id="productionLocation"
            value={formData.productionLocation}
            onChange={(e) => setFormData({ ...formData, productionLocation: e.target.value })}
            placeholder="e.g., Paris, France or Studio Name, City, Country"
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownedBy">Owned By</Label>
          <div className="space-y-2">
            <Input
              id="ownedBy"
              value={formData.ownedBy}
              onChange={(e) => setFormData({ ...formData, ownedBy: e.target.value })}
              placeholder="Current owner name or collection"
              className="font-serif"
            />
            <div className="flex items-center justify-between p-3 border border-wine/20 rounded-lg bg-parchment/50">
              <div className="space-y-0.5">
                <Label htmlFor="ownedByIsPublic" className="text-sm font-serif">
                  Make ownership public
                </Label>
                <p className="text-xs text-ink/60 font-serif">
                  By default, ownership information is private and only visible to you.
                </p>
              </div>
              <Switch
                id="ownedByIsPublic"
                checked={formData.ownedByIsPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, ownedByIsPublic: checked })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="soldBy">Sold By</Label>
          <div className="space-y-2">
            <Input
              id="soldBy"
              value={formData.soldBy}
              onChange={(e) => setFormData({ ...formData, soldBy: e.target.value })}
              placeholder="Gallery, dealer, or seller name"
              className="font-serif"
            />
            <div className="flex items-center justify-between p-3 border border-wine/20 rounded-lg bg-parchment/50">
              <div className="space-y-0.5">
                <Label htmlFor="soldByIsPublic" className="text-sm font-serif">
                  Make seller information public
                </Label>
                <p className="text-xs text-ink/60 font-serif">
                  By default, seller information is private and only visible to you.
                </p>
              </div>
              <Switch
                id="soldByIsPublic"
                checked={formData.soldByIsPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, soldByIsPublic: checked })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="auctionHistory">Auction History</Label>
          <Textarea
            id="auctionHistory"
            value={formData.auctionHistory}
            onChange={(e) => setFormData({ ...formData, auctionHistory: e.target.value })}
            placeholder="Records of previous sales at auction houses including dates and lot numbers (e.g., Sotheby's, New York, May 15, 2010, Lot 45; Christie's, London, November 20, 2015, Lot 123)"
            rows={4}
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exhibitionHistory">Exhibition History / Literature References</Label>
          <GallerySelector
            value={formData.exhibitionHistory}
            onChange={(value) => setFormData({ ...formData, exhibitionHistory: value })}
          />
          <Textarea
            id="exhibitionHistory"
            value={formData.exhibitionHistory}
            onChange={(e) => setFormData({ ...formData, exhibitionHistory: e.target.value })}
            placeholder="List exhibitions where the work has been shown or publications where it has been discussed (e.g., 'Modern Masters', Museum of Art, 2012; Featured in 'Art Today' by Jane Doe, 2015). You can also search and select galleries above."
            rows={4}
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="historicContext">Historic Context / Origin Information</Label>
          <Textarea
            id="historicContext"
            value={formData.historicContext}
            onChange={(e) => setFormData({ ...formData, historicContext: e.target.value })}
            placeholder="How and where the work was acquired originally, including any notable historical context (e.g., Acquired directly from the artist's studio in Paris, 1925; Part of the original collection of..."
            rows={4}
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="celebrityNotes">Special Notes on Celebrity or Notable Ownership</Label>
          <Textarea
            id="celebrityNotes"
            value={formData.celebrityNotes}
            onChange={(e) => setFormData({ ...formData, celebrityNotes: e.target.value })}
            placeholder="Highlight any association with famous figures or important collections when relevant (e.g., Formerly in the collection of [Celebrity Name]; Part of the [Notable Collection Name])"
            rows={4}
            className="font-serif"
          />
        </div>

        {/* Privacy Setting */}
        <div className="space-y-2 p-4 border border-wine/20 rounded-lg bg-parchment/50">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isPublic" className="text-base font-serif">
                Make artwork public
              </Label>
              <p className="text-sm text-ink/60 font-serif">
                Public artworks are visible to everyone. Private artworks are only visible to you.
              </p>
            </div>
            <Switch
              id="isPublic"
              checked={formData.isPublic}
              onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={pending}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {pending ? 'Saving...' : 'Save Provenance Information'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/artworks/${artwork.id}/certificate`)}
          disabled={pending}
          className="font-serif"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

