'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { toast } from '@kit/ui/sonner';
import { updateFeaturedEntry } from '../_actions/update-featured-entry';
import { getFeaturedEntry } from '../_actions/get-featured-entry';

type FeaturedEntry = {
  artwork_id: string | null;
  title: string;
  description: string;
  link_url: string;
  image_url: string | null;
};

export function FeaturedEntryManager() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FeaturedEntry>({
    artwork_id: null,
    title: '',
    description: '',
    link_url: '',
    image_url: null,
  });

  // Load current featured entry
  useEffect(() => {
    async function loadFeaturedEntry() {
      try {
        const result = await getFeaturedEntry();
        if (result.featuredEntry) {
          setFormData(result.featuredEntry);
        }
      } catch (e) {
        console.error('Error loading featured entry:', e);
      } finally {
        setLoading(false);
      }
    }
    loadFeaturedEntry();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.title || !formData.description) {
      setError('Title and description are required');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateFeaturedEntry(formData);
        
        if (result.error) {
          setError(result.error);
          toast.error(result.error);
        } else {
          setSuccess(true);
          toast.success('Featured entry updated successfully!');
          setTimeout(() => setSuccess(false), 3000);
          router.refresh(); // Refresh to show updated featured entry on homepage
        }
      } catch (e) {
        const errorMessage = 'Something went wrong. Please try again.';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error(e);
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-ink/70 font-serif">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Featured Entry</CardTitle>
        <CardDescription>
          Set the featured entry that appears on the homepage. You can link to an artwork or any URL.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                Featured entry updated successfully! The homepage will reflect your changes.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="artwork_id">Artwork ID (Optional)</Label>
              <Input
                id="artwork_id"
                value={formData.artwork_id || ''}
                onChange={(e) => setFormData({ ...formData, artwork_id: e.target.value || null })}
                placeholder="e.g., abc123-def456-ghi789"
                className="font-serif"
              />
              <p className="text-xs text-ink/60 font-serif">
                If you want to feature a specific artwork, enter its ID here. Otherwise, leave blank and use custom title/description below.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., The Recovered Vermeer: A Timeline of Ownership"
                className="font-serif"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the featured entry..."
                rows={4}
                className="font-serif"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_url">Link URL</Label>
              <Input
                id="link_url"
                type="url"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                placeholder="e.g., /articles/recovered-vermeer or /artworks/abc123/certificate"
                className="font-serif"
              />
              <p className="text-xs text-ink/60 font-serif">
                URL to link to when clicking the featured entry. Can be relative (e.g., /artworks/123) or absolute.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL (Optional)</Label>
              <Input
                id="image_url"
                type="url"
                value={formData.image_url || ''}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value || null })}
                placeholder="https://example.com/image.jpg"
                className="font-serif"
              />
              <p className="text-xs text-ink/60 font-serif">
                If an artwork ID is provided, the artwork image will be used automatically. Otherwise, provide an image URL here.
              </p>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={pending}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {pending ? 'Saving...' : 'Save Featured Entry'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

