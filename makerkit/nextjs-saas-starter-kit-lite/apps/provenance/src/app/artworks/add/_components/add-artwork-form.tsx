'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Camera, X, Upload, ImageIcon } from 'lucide-react';
import { createArtworksBatch } from '../_actions/create-artworks-batch';

type ImagePreview = {
  file: File;
  preview: string;
  title: string;
  isHeic?: boolean;
};

/**
 * Infer MIME type from file extension when the browser doesn't provide one.
 * Older Android WebViews and some file managers omit file.type entirely.
 */
function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  };
  return map[ext] ?? '';
}

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
  // Two separate inputs so the `capture` attribute is static and reliable across iOS/Android
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [formData, setFormData] = useState({
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Use inferred MIME type so files from Android WebViews or Windows with
    // missing file.type are not silently dropped.
    const imageFiles = Array.from(files).filter(f =>
      inferMimeType(f).startsWith('image/'),
    );
    if (imageFiles.length === 0) return;

    const newPreviews: ImagePreview[] = [];
    let processedCount = 0;

    const maybeCommit = () => {
      processedCount++;
      if (processedCount === imageFiles.length) {
        setImagePreviews(prev => [...prev, ...newPreviews]);
      }
    };

    imageFiles.forEach((file, index) => {
      const mimeType = inferMimeType(file);
      const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif';
      const title =
        file.name.replace(/\.[^/.]+$/, '') ||
        `Artwork ${imagePreviews.length + index + 1}`;

      if (isHeic) {
        // Browsers cannot decode HEIC; skip FileReader and use a placeholder.
        newPreviews.push({ file, preview: '', title, isHeic: true });
        maybeCommit();
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push({
          file,
          preview: reader.result as string,
          title,
        });
        maybeCommit();
      };
      reader.readAsDataURL(file);
    });

    // Reset both inputs so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const updateImageTitle = (index: number, title: string) => {
    setImagePreviews(prev => 
      prev.map((img, i) => i === index ? { ...img, title } : img)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (imagePreviews.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    // Validate all images have titles
    const missingTitles = imagePreviews.filter(img => !img.title.trim());
    if (missingTitles.length > 0) {
      setError('Please provide a title for all artworks');
      return;
    }

    startTransition(async () => {
      try {
        const formDataToSend = new FormData();
        
        // Append all images
        imagePreviews.forEach((img, index) => {
          formDataToSend.append(`images`, img.file);
          formDataToSend.append(`titles`, img.title);
        });
        
        formDataToSend.append('description', formData.description);
        formDataToSend.append('artistName', formData.artistName);
        formDataToSend.append('medium', formData.medium);

        const result = await createArtworksBatch(formDataToSend, userId);
        
        if (result.error) {
          setError(result.error);
        } else if (result.artworkIds && result.artworkIds.length > 0) {
          // If only one artwork, go to its certificate, otherwise go to artworks feed
          if (result.artworkIds.length === 1) {
            router.push(`/artworks/${result.artworkIds[0]}/certificate`);
          } else {
            router.push('/artworks');
          }
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
        <Label htmlFor="images">Artwork Images *</Label>
        <div className="border-2 border-dashed border-wine/30 rounded-lg p-6 bg-parchment/50">
          {/* File picker — no capture so users get full gallery/file access */}
          <input
            ref={fileInputRef}
            type="file"
            id="images"
            accept="image/*,.heic,.heif"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Camera input — static capture attribute for reliable iOS/Android behaviour */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Upload Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="flex-1 font-serif border-wine/30 hover:bg-wine/10"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Photos
            </Button>
            <Button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              variant="outline"
              className="flex-1 font-serif border-wine/30 hover:bg-wine/10"
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
          </div>

          {/* Image Previews */}
          {imagePreviews.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-ink/70 font-serif">
                {imagePreviews.length} {imagePreviews.length === 1 ? 'image' : 'images'} selected
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imagePreviews.map((img, index) => (
                  <div key={index} className="relative border border-wine/20 rounded-lg p-3 bg-white">
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {img.isHeic ? (
                      <div className="w-full h-48 flex flex-col items-center justify-center rounded-lg mb-2 bg-parchment/60 border border-wine/10">
                        <ImageIcon className="h-10 w-10 text-wine/40 mb-2" />
                        <span className="text-xs text-ink/50 font-serif text-center px-2 truncate max-w-full">
                          {img.file.name}
                        </span>
                        <span className="text-xs text-ink/40 font-serif mt-1">
                          HEIC — will be uploaded as-is
                        </span>
                      </div>
                    ) : (
                      <img
                        src={img.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg mb-2"
                      />
                    )}
                    <Input
                      value={img.title}
                      onChange={(e) => updateImageTitle(index, e.target.value)}
                      placeholder="Artwork title"
                      className="font-serif text-sm"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {imagePreviews.length === 0 && (
            <div className="space-y-2 text-center py-8">
              <p className="text-ink/70 font-serif">
                Click to upload images or take photos
              </p>
              <p className="text-xs text-ink/50">
                JPG, PNG, WEBP, GIF, or HEIC up to 10MB each. Select multiple images at once.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="artistName">Artist Name</Label>
          <Input
            id="artistName"
            value={formData.artistName}
            onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
            placeholder="Artist or creator name"
            className="font-serif"
          />
          <p className="text-xs text-ink/60 font-serif">
            This will be applied to all artworks
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="medium">Medium</Label>
          <Input
            id="medium"
            value={formData.medium}
            onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
            placeholder="e.g., Oil on Canvas"
            className="font-serif"
          />
          <p className="text-xs text-ink/60 font-serif">
            This will be applied to all artworks
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the artworks, their history, and any notable features..."
          rows={4}
          className="font-serif"
        />
        <p className="text-xs text-ink/60 font-serif">
          This description will be applied to all artworks
        </p>
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={pending || imagePreviews.length === 0}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {pending 
            ? `Creating ${imagePreviews.length} ${imagePreviews.length === 1 ? 'Certificate' : 'Certificates'}...` 
            : `Create ${imagePreviews.length > 0 ? `${imagePreviews.length} ` : ''}Certificate${imagePreviews.length !== 1 ? 's' : ''} of Authenticity`}
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

