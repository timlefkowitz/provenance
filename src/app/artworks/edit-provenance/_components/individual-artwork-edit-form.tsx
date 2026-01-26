'use client';

import { useState } from 'react';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Separator } from '@kit/ui/separator';

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

type ArtworkFormData = {
  artist_name: string;
  description: string;
  creation_date: string;
  medium: string;
  dimensions: string;
  former_owners: string;
  auction_history: string;
  exhibition_history: string;
  historic_context: string;
  celebrity_notes: string;
  is_public: boolean | null;
  value: string;
  value_is_public: boolean | null;
  edition: string;
  production_location: string;
  owned_by: string;
  owned_by_is_public: boolean | null;
  sold_by: string;
  sold_by_is_public: boolean | null;
};

export function IndividualArtworkEditForm({
  artwork,
  onDataChange,
}: {
  artwork: Artwork;
  onDataChange: (artworkId: string, data: ArtworkFormData) => void;
}) {
  const [formData, setFormData] = useState<ArtworkFormData>(() => ({
    artist_name: artwork.artist_name || '',
    description: artwork.description || '',
    creation_date: artwork.creation_date ? artwork.creation_date.split('T')[0] : '',
    medium: artwork.medium || '',
    dimensions: artwork.dimensions || '',
    former_owners: artwork.former_owners || '',
    auction_history: artwork.auction_history || '',
    exhibition_history: artwork.exhibition_history || '',
    historic_context: artwork.historic_context || '',
    celebrity_notes: artwork.celebrity_notes || '',
    is_public: artwork.is_public,
    value: artwork.value || '',
    value_is_public: artwork.value_is_public,
    edition: artwork.edition || '',
    production_location: artwork.production_location || '',
    owned_by: artwork.owned_by || '',
    owned_by_is_public: artwork.owned_by_is_public,
    sold_by: artwork.sold_by || '',
    sold_by_is_public: artwork.sold_by_is_public,
  }));

  const updateField = (field: keyof ArtworkFormData, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onDataChange(artwork.id, newData);
  };

  return (
    <Card className="border-wine/30 bg-parchment/60">
      <CardHeader>
        <CardTitle className="font-display text-xl text-wine">
          {artwork.title}
          {artwork.artist_name && (
            <span className="text-base font-serif font-normal text-ink/70 ml-2">
              by {artwork.artist_name}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="font-display text-lg text-wine mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor={`artist-${artwork.id}`} className="font-serif">Artist Name</Label>
              <Input
                id={`artist-${artwork.id}`}
                value={formData.artist_name}
                onChange={(e) => updateField('artist_name', e.target.value)}
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor={`desc-${artwork.id}`} className="font-serif">Description</Label>
              <Textarea
                id={`desc-${artwork.id}`}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="font-serif"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`date-${artwork.id}`} className="font-serif">Creation Date</Label>
                <Input
                  id={`date-${artwork.id}`}
                  type="date"
                  value={formData.creation_date}
                  onChange={(e) => updateField('creation_date', e.target.value)}
                  className="font-serif"
                />
              </div>

              <div>
                <Label htmlFor={`medium-${artwork.id}`} className="font-serif">Medium</Label>
                <Input
                  id={`medium-${artwork.id}`}
                  value={formData.medium}
                  onChange={(e) => updateField('medium', e.target.value)}
                  placeholder="e.g., Oil on Canvas"
                  className="font-serif"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`dims-${artwork.id}`} className="font-serif">Dimensions</Label>
              <Input
                id={`dims-${artwork.id}`}
                value={formData.dimensions}
                onChange={(e) => updateField('dimensions', e.target.value)}
                placeholder="e.g., 24 x 36 inches"
                className="font-serif"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Provenance History */}
        <div>
          <h3 className="font-display text-lg text-wine mb-4">Provenance History</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor={`owners-${artwork.id}`} className="font-serif">Former Owners</Label>
              <Textarea
                id={`owners-${artwork.id}`}
                value={formData.former_owners}
                onChange={(e) => updateField('former_owners', e.target.value)}
                placeholder="Names of former owners, collectors, galleries, or institutions"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor={`auction-${artwork.id}`} className="font-serif">Auction History</Label>
              <Textarea
                id={`auction-${artwork.id}`}
                value={formData.auction_history}
                onChange={(e) => updateField('auction_history', e.target.value)}
                placeholder="Records of previous sales at auction houses"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor={`exhibition-${artwork.id}`} className="font-serif">Exhibition History</Label>
              <Textarea
                id={`exhibition-${artwork.id}`}
                value={formData.exhibition_history}
                onChange={(e) => updateField('exhibition_history', e.target.value)}
                placeholder="Exhibition history or literature references"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor={`historic-${artwork.id}`} className="font-serif">Historic Context</Label>
              <Textarea
                id={`historic-${artwork.id}`}
                value={formData.historic_context}
                onChange={(e) => updateField('historic_context', e.target.value)}
                placeholder="Historic context / origin information"
                className="font-serif"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor={`celebrity-${artwork.id}`} className="font-serif">Celebrity Notes</Label>
              <Textarea
                id={`celebrity-${artwork.id}`}
                value={formData.celebrity_notes}
                onChange={(e) => updateField('celebrity_notes', e.target.value)}
                placeholder="Special notes on celebrity or notable ownership"
                className="font-serif"
                rows={2}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Value & Ownership */}
        <div>
          <h3 className="font-display text-lg text-wine mb-4">Value & Ownership</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`value-${artwork.id}`} className="font-serif">Value</Label>
                <Input
                  id={`value-${artwork.id}`}
                  value={formData.value}
                  onChange={(e) => updateField('value', e.target.value)}
                  placeholder="e.g., $10,000"
                  className="font-serif"
                />
              </div>

              <div>
                <Label htmlFor={`edition-${artwork.id}`} className="font-serif">Edition</Label>
                <Input
                  id={`edition-${artwork.id}`}
                  value={formData.edition}
                  onChange={(e) => updateField('edition', e.target.value)}
                  placeholder="e.g., 1/10"
                  className="font-serif"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`location-${artwork.id}`} className="font-serif">Production Location</Label>
              <Input
                id={`location-${artwork.id}`}
                value={formData.production_location}
                onChange={(e) => updateField('production_location', e.target.value)}
                placeholder="Where the artwork was created"
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor={`owned-${artwork.id}`} className="font-serif">Owned By</Label>
              <Input
                id={`owned-${artwork.id}`}
                value={formData.owned_by}
                onChange={(e) => updateField('owned_by', e.target.value)}
                placeholder="Current owner name"
                className="font-serif"
              />
            </div>

            <div>
              <Label htmlFor={`sold-${artwork.id}`} className="font-serif">Sold By</Label>
              <Input
                id={`sold-${artwork.id}`}
                value={formData.sold_by}
                onChange={(e) => updateField('sold_by', e.target.value)}
                placeholder="Gallery or seller name"
                className="font-serif"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Privacy Settings */}
        <div>
          <h3 className="font-display text-lg text-wine mb-4">Privacy Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`public-${artwork.id}`} className="font-serif">Make Artwork Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show this artwork in public galleries
                </p>
              </div>
              <Switch
                id={`public-${artwork.id}`}
                checked={formData.is_public ?? false}
                onCheckedChange={(checked) => updateField('is_public', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`value-public-${artwork.id}`} className="font-serif">Make Value Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show value information publicly
                </p>
              </div>
              <Switch
                id={`value-public-${artwork.id}`}
                checked={formData.value_is_public ?? false}
                onCheckedChange={(checked) => updateField('value_is_public', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`owner-public-${artwork.id}`} className="font-serif">Make Owner Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show owner information publicly
                </p>
              </div>
              <Switch
                id={`owner-public-${artwork.id}`}
                checked={formData.owned_by_is_public ?? false}
                onCheckedChange={(checked) => updateField('owned_by_is_public', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`seller-public-${artwork.id}`} className="font-serif">Make Seller Public</Label>
                <p className="text-sm text-ink/60 font-serif">
                  Show seller information publicly
                </p>
              </div>
              <Switch
                id={`seller-public-${artwork.id}`}
                checked={formData.sold_by_is_public ?? false}
                onCheckedChange={(checked) => updateField('sold_by_is_public', checked)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
