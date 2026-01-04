'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Camera, X, Upload } from 'lucide-react';
import { createArtworksBatch } from '../_actions/create-artworks-batch';

type ImagePreview = {
  file: File;
  preview: string;
  title: string;
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newPreviews: ImagePreview[] = [];
    let processedCount = 0;
    
    imageFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        const newPreview: ImagePreview = {
          file,
          preview,
          title: file.name.replace(/\.[^/.]+$/, '') || `Artwork ${imagePreviews.length + index + 1}`,
        };
        newPreviews.push(newPreview);
        processedCount++;
        
        // Update state when all files are processed
        if (processedCount === imageFiles.length) {
          setImagePreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input to allow selecting the same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            id="images"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Upload Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  // Remove capture attribute for file selection
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
              variant="outline"
              className="flex-1 font-serif border-wine/30 hover:bg-wine/10"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Photos
            </Button>
            <Button
              type="button"
              onClick={() => {
                // For camera, set capture attribute to use device camera
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
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
                    <img
                      src={img.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg mb-2"
                    />
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
                PNG, JPG, or WEBP up to 10MB each. You can select multiple images.
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

