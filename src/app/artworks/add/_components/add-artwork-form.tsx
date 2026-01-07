'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Camera, X, Upload, MapPin } from 'lucide-react';
import { createArtworksBatch } from '../_actions/create-artworks-batch';

type ImagePreview = {
  file: File;
  preview: string;
  title: string;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    region?: string;
    country?: string;
    formatted?: string;
  } | null;
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
  const [compressing, setCompressing] = useState(false);
  const [primaryTitle, setPrimaryTitle] = useState('');
  const [formData, setFormData] = useState({
    description: '',
    artistName: defaultArtistName,
    medium: defaultMedium,
    isPublic: true, // Default to public
  });

  // Update form data when defaults change (only if fields are empty)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      artistName: prev.artistName || defaultArtistName,
      medium: prev.medium || defaultMedium,
    }));
  }, [defaultArtistName, defaultMedium]);

  // Keep primaryTitle in sync with the single image title (common case: one artwork)
  useEffect(() => {
    if (imagePreviews.length === 1) {
      // When a single image is added and no primary title yet, initialize it
      if (!primaryTitle) {
        setPrimaryTitle(imagePreviews[0].title);
      } else if (imagePreviews[0].title !== primaryTitle) {
        // When primary title changes, update the image title to match
        setImagePreviews(prev =>
          prev.map((img, index) =>
            index === 0 ? { ...img, title: primaryTitle } : img,
          ),
        );
      }
    }
  }, [imagePreviews, primaryTitle]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setCompressing(true);
    setError(null);

    try {
      const newPreviews: ImagePreview[] = [];
      
      // Process and compress each image
      for (let index = 0; index < imageFiles.length; index++) {
        const file = imageFiles[index];
        
        // Compression options optimized for iPhone photos
        const options = {
          maxSizeMB: 2, // Compress to max 2MB (good quality, much smaller than original)
          maxWidthOrHeight: 1920, // Max dimension (good for web display)
          useWebWorker: true, // Use web worker for better performance
          fileType: file.type, // Preserve original file type
        };

        let compressedFile: File;
        try {
          compressedFile = await imageCompression(file, options);
        } catch (compressionError) {
          console.warn('Compression failed, using original file:', compressionError);
          compressedFile = file; // Fallback to original if compression fails
        }

        // Create preview
        const reader = new FileReader();
        const preview = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(compressedFile);
        });

        // Extract location from EXIF data (use original file for EXIF, not compressed)
        let location: ImagePreview['location'] = null;
        try {
          const exifData = await exifr.gps(file);
          if (exifData?.latitude && exifData?.longitude) {
            // Try to get reverse geocoded location
            try {
              const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${exifData.latitude}&longitude=${exifData.longitude}&localityLanguage=en`
              );
              const geoData = await response.json();
              
              location = {
                latitude: exifData.latitude,
                longitude: exifData.longitude,
                city: geoData.city || geoData.locality,
                region: geoData.principalSubdivision,
                country: geoData.countryName,
                formatted: geoData.locality 
                  ? `${geoData.locality}, ${geoData.principalSubdivision || geoData.countryName}`
                  : geoData.principalSubdivision 
                    ? `${geoData.principalSubdivision}, ${geoData.countryName}`
                    : geoData.countryName || null,
              };
            } catch (geoError) {
              // If reverse geocoding fails, just store coordinates
              location = {
                latitude: exifData.latitude,
                longitude: exifData.longitude,
              };
            }
          }
        } catch (exifError) {
          // No location data available, that's okay
          console.log('No location data in image:', exifError);
        }

        const newPreview: ImagePreview = {
          file: compressedFile,
          preview,
          title: file.name.replace(/\.[^/.]+$/, '') || `Artwork ${imagePreviews.length + index + 1}`,
          location,
        };
        newPreviews.push(newPreview);
      }

      setImagePreviews(prev => [...prev, ...newPreviews]);
    } catch (error) {
      console.error('Error processing images:', error);
      setError('Failed to process images. Please try again.');
    } finally {
      setCompressing(false);
      // Reset input to allow selecting the same files again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
          // Append location data if available
          if (img.location) {
            formDataToSend.append(`locations`, JSON.stringify(img.location));
          } else {
            formDataToSend.append(`locations`, '');
          }
        });
        
        formDataToSend.append('description', formData.description);
        formDataToSend.append('artistName', formData.artistName);
        formDataToSend.append('medium', formData.medium);
        formDataToSend.append('isPublic', formData.isPublic.toString());

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

      {/* Primary Title (for the main artwork) */}
      <div className="space-y-2">
        <Label htmlFor="primaryTitle">Artwork Title</Label>
        <Input
          id="primaryTitle"
          value={primaryTitle}
          onChange={(e) => setPrimaryTitle(e.target.value)}
          placeholder="e.g., Dawn over the Valley"
          className="font-serif"
        />
        <p className="text-xs text-ink/60 font-serif">
          This will be applied to the first artwork. You can still edit individual titles under each photo.
        </p>
      </div>

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
              disabled={compressing}
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
              disabled={compressing}
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
          </div>

          {/* Compression Status */}
          {compressing && (
            <div className="mb-4 p-3 bg-wine/10 border border-wine/20 rounded-lg">
              <p className="text-sm text-wine font-serif text-center">
                Compressing images for faster upload...
              </p>
            </div>
          )}

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
                    <div className="relative">
                      <img
                        src={img.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg mb-2"
                      />
                      {img.location && (
                        <div className="absolute top-2 left-2 bg-wine/90 text-parchment px-2 py-1 rounded text-xs font-serif flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{img.location.formatted || 'Location detected'}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-left">
                      <Label htmlFor={`title-${index}`} className="text-xs font-serif text-ink/70">
                        Title for this artwork *
                      </Label>
                      <Input
                        id={`title-${index}`}
                        value={img.title}
                        onChange={(e) => updateImageTitle(index, e.target.value)}
                        placeholder="e.g., Dawn over the Valley"
                        className="font-serif text-sm"
                        required
                      />
                    </div>
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

      {/* Privacy Setting */}
      <div className="space-y-2 p-4 border border-wine/20 rounded-lg bg-parchment/50">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="isPublic" className="text-base font-serif">
              Make artworks public
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

