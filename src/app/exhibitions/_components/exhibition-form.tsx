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
import { ArtistSelector } from './artist-selector';

type Artist = {
  id: string;
  name: string;
  picture_url: string | null;
};

export function ExhibitionForm({
  exhibition,
}: {
  exhibition?: any;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Initialize selected artists and metadata from exhibition if editing
  const initialArtists = (exhibition as any)?.artists || [];
  const initialMetadata = (exhibition as any)?.metadata || {};
  
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>(initialArtists);

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
  });

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
        // Append artist IDs as JSON array
        formDataObj.append('artistIds', JSON.stringify(selectedArtists.map(a => a.id)));

        if (exhibition) {
          await updateExhibition(exhibition.id, formDataObj);
          toast.success('Exhibition updated successfully');
        } else {
          await createExhibition(formDataObj);
          toast.success('Exhibition created successfully');
        }

        router.push('/exhibitions');
        router.refresh();
      } catch (e: any) {
        const errorMessage = e?.message || 'Failed to save exhibition';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Exhibition Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="e.g., Spring Collection 2024"
            className="font-serif"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Describe the exhibition..."
            rows={4}
            className="font-serif"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className="font-serif"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData({ ...formData, endDate: e.target.value })
              }
              className="font-serif"
              min={formData.startDate}
            />
            <p className="text-xs text-ink/60 font-serif">
              Leave empty for ongoing exhibitions
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            placeholder="e.g., Gallery Name, City, Country"
            className="font-serif"
          />
        </div>

        <ArtistSelector
          selectedArtists={selectedArtists}
          onArtistsChange={setSelectedArtists}
        />

        <div className="space-y-2">
          <Label htmlFor="curator">Curator</Label>
          <Input
            id="curator"
            value={formData.curator}
            onChange={(e) =>
              setFormData({ ...formData, curator: e.target.value })
            }
            placeholder="e.g., Jane Smith"
            className="font-serif"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Input
            id="theme"
            value={formData.theme}
            onChange={(e) =>
              setFormData({ ...formData, theme: e.target.value })
            }
            placeholder="e.g., Abstract Expressionism, Contemporary Portraits"
            className="font-serif"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={pending}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
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
          className="font-serif border-wine/30 hover:bg-wine/10"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

