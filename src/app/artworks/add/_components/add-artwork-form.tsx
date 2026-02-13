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
import type { UserRole } from '~/lib/user-roles';
import { USER_ROLES, getCreateCertificateButtonLabel } from '~/lib/user-roles';
import type { UserExhibition } from '../_actions/get-user-exhibitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { CreateExhibitionDialog } from './create-exhibition-dialog';
import type { PastArtist } from '../_actions/get-past-artists';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

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
  defaultMedium = '',
  userRole = null,
  exhibitions = [],
  pastArtists = [],
  galleryProfiles = [],
  onExhibitionsChange,
}: { 
  userId: string;
  defaultArtistName?: string;
  defaultMedium?: string;
  userRole?: UserRole | null;
  exhibitions?: UserExhibition[];
  pastArtists?: PastArtist[];
  galleryProfiles?: UserProfile[];
  onExhibitionsChange?: (exhibitions: UserExhibition[]) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ batch: number; totalBatches: number } | null>(null);
  const [primaryTitle, setPrimaryTitle] = useState('');
  const [localExhibitions, setLocalExhibitions] = useState<UserExhibition[]>(exhibitions);
  const [formData, setFormData] = useState({
    description: '',
    artistName: defaultArtistName,
    medium: defaultMedium,
    creationDate: '',
    isPublic: true, // Default to public
    exhibitionId: '',
    galleryProfileId: '',
  });

  // Update local exhibitions when prop changes
  useEffect(() => {
    setLocalExhibitions(exhibitions);
  }, [exhibitions]);

  // Update form data when defaults change (only if fields are empty)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      artistName: prev.artistName || defaultArtistName,
      medium: prev.medium || defaultMedium,
    }));
  }, [defaultArtistName, defaultMedium]);

  // Auto-select gallery profile if there's only one
  useEffect(() => {
    if (userRole === USER_ROLES.GALLERY && galleryProfiles.length === 1 && !formData.galleryProfileId) {
      setFormData(prev => ({
        ...prev,
        galleryProfileId: galleryProfiles[0].id,
      }));
    } else if (userRole !== USER_ROLES.GALLERY) {
      // Clear gallery profile selection if not in gallery mode
      setFormData(prev => ({
        ...prev,
        galleryProfileId: '',
      }));
    }
  }, [userRole, galleryProfiles, formData.galleryProfileId]);

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
      
      // Process and compress each image (Vercel has 4.5MB request body limit – keep each image ~700KB so multiple images fit)
      const compressionOptions: Parameters<typeof imageCompression>[1] = {
        maxSizeMB: 0.7,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.85,
      };
      const fallbackOptions: Parameters<typeof imageCompression>[1] = {
        ...compressionOptions,
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1280,
        initialQuality: 0.75,
      };
      // Last resort: main thread + original format (avoids worker decode and JPEG conversion issues)
      const lastResortOptions = (f: File): Parameters<typeof imageCompression>[1] => ({
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: false,
        fileType: f.type || 'image/jpeg',
      });

      // If compression fails entirely, use original file when under this size (keeps batch under body limit)
      const MAX_ORIGINAL_FALLBACK_BYTES = 3 * 1024 * 1024; // 3 MB
      const failedNames: string[] = [];

      for (let index = 0; index < imageFiles.length; index++) {
        const file = imageFiles[index];
        if (file.size > 50 * 1024 * 1024) {
          setError(`"${file.name}" is too large. Please choose images under 50 MB.`);
          setCompressing(false);
          return;
        }

        let compressedFile: File;
        try {
          compressedFile = await imageCompression(file, compressionOptions);
          if (compressedFile.size > 1024 * 1024) {
            compressedFile = await imageCompression(file, fallbackOptions);
          }
        } catch (compressionError) {
          console.warn('Compression failed, trying aggressive compression:', compressionError);
          try {
            compressedFile = await imageCompression(file, fallbackOptions);
          } catch (fallbackError) {
            console.warn('Aggressive compression failed, trying main thread + original format:', fallbackError);
            try {
              compressedFile = await imageCompression(file, lastResortOptions(file));
            } catch (lastError) {
              try {
                compressedFile = await imageCompression(file, {
                  ...lastResortOptions(file),
                  fileType: 'image/jpeg',
                });
              } catch (finalError) {
                console.error('All compression attempts failed:', finalError);
                // Use original file if small enough so one bad image doesn't block the batch
                if (file.size <= MAX_ORIGINAL_FALLBACK_BYTES) {
                  compressedFile = file;
                } else {
                  failedNames.push(file.name);
                  continue; // skip this image, process the rest
                }
              }
            }
          }
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

      if (failedNames.length > 0) {
        setError(
          `Could not process ${failedNames.length} ${failedNames.length === 1 ? 'image' : 'images'}: ${failedNames.join(', ')}. Try re-exporting as JPEG from Photos or Preview, or use different images. The rest were added.`
        );
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

    // Validate gallery profile selection if user is a gallery with multiple profiles
    if (userRole === USER_ROLES.GALLERY && galleryProfiles.length > 1 && !formData.galleryProfileId) {
      setError('Please select which gallery you are posting as');
      return;
    }

    // Vercel 4.5 MB body limit: send in chunks of 6 images (~4.2 MB max) so 30+ images work
    const MAX_IMAGES_PER_BATCH = 6;
    const chunks: ImagePreview[][] = [];
    for (let i = 0; i < imagePreviews.length; i += MAX_IMAGES_PER_BATCH) {
      chunks.push(imagePreviews.slice(i, i + MAX_IMAGES_PER_BATCH));
    }

    startTransition(async () => {
      setUploadProgress({ batch: 0, totalBatches: chunks.length });
      const allArtworkIds: string[] = [];
      try {
        for (let c = 0; c < chunks.length; c++) {
          setUploadProgress({ batch: c + 1, totalBatches: chunks.length });
          const chunk = chunks[c];

          const formDataToSend = new FormData();
          chunk.forEach((img) => {
            formDataToSend.append('images', img.file);
            formDataToSend.append('titles', img.title);
            formDataToSend.append('locations', img.location ? JSON.stringify(img.location) : '');
          });
          formDataToSend.append('description', formData.description);
          formDataToSend.append('artistName', formData.artistName);
          formDataToSend.append('medium', formData.medium);
          formDataToSend.append('creationDate', formData.creationDate);
          formDataToSend.append('isPublic', formData.isPublic.toString());
          if (formData.exhibitionId) formDataToSend.append('exhibitionId', formData.exhibitionId);
          if (formData.galleryProfileId) formDataToSend.append('galleryProfileId', formData.galleryProfileId);

          const result = await createArtworksBatch(formDataToSend, userId);

          if (result.error) {
            const uploaded = allArtworkIds.length;
            setError(
              uploaded > 0
                ? `${result.error} (${uploaded} of ${imagePreviews.length} uploaded successfully – you can add the rest in a new batch)`
                : result.error
            );
            setUploadProgress(null);
            return;
          }
          if (result.artworkIds?.length) {
            allArtworkIds.push(...result.artworkIds);
          }
        }
        setUploadProgress(null);
        if (allArtworkIds.length === 1) {
          router.push(`/artworks/${allArtworkIds[0]}/certificate`);
        } else {
          router.push('/artworks');
        }
      } catch (e) {
        setUploadProgress(null);
        const uploaded = allArtworkIds.length;
        setError(
          uploaded > 0
            ? `Something went wrong. ${uploaded} of ${imagePreviews.length} uploaded – you can add the rest in a new batch.`
            : 'Something went wrong. Please try again.'
        );
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
          {userRole === USER_ROLES.GALLERY && pastArtists.length > 0 ? (
            <div className="space-y-2">
              <Select
                value={formData.artistName && pastArtists.some(a => a.artist_name === formData.artistName) ? formData.artistName : '__none__'}
                onValueChange={(value) => {
                  if (value && value !== '__none__') {
                    setFormData({ ...formData, artistName: value });
                  } else {
                    setFormData({ ...formData, artistName: '' });
                  }
                }}
              >
                <SelectTrigger id="artistNameSelect" className="font-serif">
                  <SelectValue placeholder="Select a past artist or type below" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="font-serif">
                    Enter new artist name
                  </SelectItem>
                  {pastArtists.map((artist) => (
                    <SelectItem key={artist.artist_name} value={artist.artist_name} className="font-serif">
                      {artist.artist_name}
                      {artist.count > 1 && (
                        <span className="text-xs text-ink/60 ml-2">
                          ({artist.count} artworks)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="artistName"
                value={formData.artistName}
                onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                placeholder="Or type artist name here"
                className="font-serif"
              />
            </div>
          ) : (
            <Input
              id="artistName"
              value={formData.artistName}
              onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
              placeholder="Artist or creator name"
              className="font-serif"
            />
          )}
          <p className="text-xs text-ink/60 font-serif">
            This will be applied to all artworks
            {userRole === USER_ROLES.GALLERY && pastArtists.length > 0 && (
              <span className="block mt-1">
                Select from past artists or enter a new name
              </span>
            )}
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

        <div className="space-y-2">
          <Label htmlFor="creationDate">Creation Date</Label>
          <Input
            id="creationDate"
            type="date"
            value={formData.creationDate}
            onChange={(e) => setFormData({ ...formData, creationDate: e.target.value })}
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

      {/* Gallery Profile Selection (for galleries with multiple profiles) */}
      {userRole === USER_ROLES.GALLERY && galleryProfiles.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="galleryProfileId">Post as Gallery *</Label>
          <Select
            value={formData.galleryProfileId || '__none__'}
            onValueChange={(value) => {
              if (value === '__none__') {
                setFormData({ ...formData, galleryProfileId: '' });
              } else {
                setFormData({ ...formData, galleryProfileId: value });
              }
            }}
          >
            <SelectTrigger id="galleryProfileId" className="font-serif">
              <SelectValue placeholder="Select which gallery to post as" />
            </SelectTrigger>
            <SelectContent>
              {galleryProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id} className="font-serif">
                  {profile.name}
                  {profile.location && (
                    <span className="text-xs text-ink/60 ml-2">
                      ({profile.location})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-ink/60 font-serif">
            Select which gallery profile you are posting this artwork as
          </p>
        </div>
      )}

      {/* Exhibition Selection (for galleries) */}
      {userRole === USER_ROLES.GALLERY && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="exhibitionId">Exhibition (Optional)</Label>
            <CreateExhibitionDialog
              onExhibitionCreated={(newExhibition) => {
                // Add the new exhibition to the local list and select it
                const updatedExhibitions = [newExhibition, ...localExhibitions];
                setLocalExhibitions(updatedExhibitions);
                setFormData({ ...formData, exhibitionId: newExhibition.id });
                // Notify parent if callback provided
                if (onExhibitionsChange) {
                  onExhibitionsChange(updatedExhibitions);
                }
              }}
            />
          </div>
          <Select
            value={formData.exhibitionId || '__none__'}
            onValueChange={(value) => {
              if (value === '__none__') {
                setFormData({ ...formData, exhibitionId: '' });
              } else {
                setFormData({ ...formData, exhibitionId: value });
              }
            }}
          >
            <SelectTrigger id="exhibitionId" className="font-serif">
              <SelectValue placeholder="Select an exhibition (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="font-serif">
                None
              </SelectItem>
              {localExhibitions.length > 0 ? (
                localExhibitions.map((exhibition) => {
                  const startDate = exhibition.start_date ? new Date(exhibition.start_date) : null;
                  const endDate = exhibition.end_date ? new Date(exhibition.end_date) : null;
                  const now = new Date();
                  const isPast = endDate ? endDate < now : startDate ? startDate < now : false;
                  
                  return (
                    <SelectItem key={exhibition.id} value={exhibition.id} className="font-serif">
                      {exhibition.title}
                      {startDate && (
                        <span className="text-xs text-ink/60 ml-2">
                          ({startDate.getFullYear()}{isPast ? ' - Past' : ''})
                        </span>
                      )}
                    </SelectItem>
                  );
                })
              ) : (
                <SelectItem value="__placeholder__" disabled className="font-serif text-ink/40">
                  No exhibitions yet. Create one above.
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-ink/60 font-serif">
            Link this artwork to one of your exhibitions (past or current)
          </p>
        </div>
      )}

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
            ? uploadProgress
              ? `Uploading batch ${uploadProgress.batch} of ${uploadProgress.totalBatches}…`
              : `Creating ${imagePreviews.length} ${imagePreviews.length === 1 ? 'Certificate' : 'Certificates'}…`
            : getCreateCertificateButtonLabel(userRole ?? null, imagePreviews.length)}
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

