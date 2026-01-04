'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { ImageUploader } from '@kit/ui/image-uploader';
import { createArtwork } from '../_actions/create-artwork';

export function AddArtworkForm({ 
  userId, 
  defaultArtistName = '',
  defaultMedium = ''
}: { 
  userId: string;
  defaultArtistName?: string;
  defaultMedium?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    artistName: defaultArtistName,
    medium: defaultMedium,
  });

  // Update form data when defaults change (only if fields are empty)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      artistName: prev.artistName || defaultArtistName,
      medium: prev.medium || defaultMedium,
    }));
  }, [defaultArtistName, defaultMedium]);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Please enter a title for the artwork');
      return;
    }

    if (!imageFile) {
      setError('Please upload an image of the artwork');
      return;
    }

    startTransition(async () => {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('image', imageFile);
        formDataToSend.append('title', formData.title);
        formDataToSend.append('description', formData.description);
        formDataToSend.append('artistName', formData.artistName);
        formDataToSend.append('medium', formData.medium);

        const result = await createArtwork(formDataToSend, userId);
        
        if (result.error) {
          setError(result.error);
        } else {
          router.push(`/artworks/${result.artworkId}/certificate`);
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

      {/* Image Upload Section */}
      <div className="space-y-2">
        <Label htmlFor="image">Artwork Image *</Label>
        <div className="border-2 border-dashed border-wine/30 rounded-lg p-6 bg-parchment/50">
          <div className="relative">
            <ImageUploader
              value={imagePreview}
              onValueChange={handleImageChange}
            >
              {imagePreview ? (
                <div className="space-y-4 text-center">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg shadow-md cursor-pointer"
                  />
                  <p className="text-sm text-ink/70 font-serif">
                    Click to change image
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-center py-8">
                  <p className="text-ink/70 font-serif">
                    Click to upload an image
                  </p>
                  <p className="text-xs text-ink/50">
                    PNG, JPG, or WEBP up to 10MB
                  </p>
                </div>
              )}
            </ImageUploader>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Sunset Over Mountains"
            className="font-serif"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="artistName">Artist Name</Label>
          <Input
            id="artistName"
            value={formData.artistName}
            onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
            placeholder="Artist or creator name"
            className="font-serif"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the artwork, its history, and any notable features..."
          rows={4}
          className="font-serif"
        />
      </div>

      {/* Additional Details */}
      <div className="space-y-2">
        <Label htmlFor="medium">Medium</Label>
        <Input
          id="medium"
          value={formData.medium}
          onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
          placeholder="e.g., Oil on Canvas"
          className="font-serif"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={pending}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {pending ? 'Creating Certificate...' : 'Create Certificate of Authenticity'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
          className="font-serif"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

