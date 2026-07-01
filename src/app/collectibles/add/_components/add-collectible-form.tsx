'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import exifr from 'exifr';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Camera, MapPin, Upload, X } from 'lucide-react';
import {
  COLLECTIBLE_CATEGORIES,
  COLLECTIBLE_CONDITIONS,
  GRADING_SERVICES,
  formatCategoryLabel,
  formatConditionLabel,
} from '~/lib/collectibles/constants';
import { createCollectible } from '../_actions/create-collectible';

const MAX_IMAGES = 6;
const MAX_SINGLE_IMAGE_BYTES = 4 * 1024 * 1024;

type DetectedLocation = {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  formatted?: string;
} | null;

type PendingImage = {
  file: File;
  previewUrl: string;
};

async function maybeCompressImage(file: File): Promise<File> {
  if (file.size <= MAX_SINGLE_IMAGE_BYTES || typeof createImageBitmap === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 2000;
    let { width, height } = bitmap;
    let targetWidth = width;
    let targetHeight = height;
    if (width > height && width > maxDim) {
      targetWidth = maxDim;
      targetHeight = Math.round((maxDim / width) * height);
    } else if (height >= width && height > maxDim) {
      targetHeight = maxDim;
      targetWidth = Math.round((maxDim / height) * width);
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('compression failed'))),
        'image/jpeg',
        0.8,
      );
    });
    const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpeg', {
      type: 'image/jpeg',
    });
    return compressed.size < file.size ? compressed : file;
  } catch (err) {
    console.warn('[Collectibles] image compression failed, using original', err);
    return file;
  }
}

export function AddCollectibleForm({ userId }: { userId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<PendingImage[]>([]);
  const [location, setLocation] = useState<DetectedLocation>(null);

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    subcategory: '',
    manufacturer: '',
    year: '',
    condition: '',
    gradingService: '',
    gradingScore: '',
    serialNumber: '',
    description: '',
    value: '',
    valueIsPublic: false,
    isPublic: false,
  });

  // Revoke blob URLs on unmount to avoid memory leaks.
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index]!.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);

    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const incoming = Array.from(files).slice(0, slots);
    if (files.length > slots) {
      setError(
        `Only ${slots} more photo${slots === 1 ? '' : 's'} can be added (max ${MAX_IMAGES}). The first ${slots} ${slots === 1 ? 'was' : 'were'} added.`,
      );
    }

    const processed: PendingImage[] = [];
    for (const raw of incoming) {
      if (!raw.type.startsWith('image/')) {
        setError('Please choose image files only.');
        continue;
      }
      let picked = raw;
      if (picked.size > MAX_SINGLE_IMAGE_BYTES) {
        picked = await maybeCompressImage(picked);
        if (picked.size > MAX_SINGLE_IMAGE_BYTES) {
          setError(`"${raw.name}" is too large. Please choose images under 4 MB.`);
          continue;
        }
      }
      processed.push({ file: picked, previewUrl: URL.createObjectURL(picked) });
    }

    if (processed.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // EXIF GPS from the first new photo (only if we have no location yet).
    if (!location && processed[0]) {
      try {
        const gps = await exifr.gps(processed[0].file);
        if (gps?.latitude && gps?.longitude) {
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${gps.latitude}&longitude=${gps.longitude}&localityLanguage=en`,
            );
            const geo = await res.json();
            setLocation({
              latitude: gps.latitude,
              longitude: gps.longitude,
              city: geo.city || geo.locality,
              region: geo.principalSubdivision,
              country: geo.countryName,
              formatted: geo.locality
                ? `${geo.locality}, ${geo.principalSubdivision || geo.countryName}`
                : geo.principalSubdivision
                  ? `${geo.principalSubdivision}, ${geo.countryName}`
                  : geo.countryName || undefined,
            });
          } catch {
            setLocation({ latitude: gps.latitude, longitude: gps.longitude });
          }
        }
      } catch {
        // EXIF unavailable — no location to set
      }
    }

    setImages((prev) => {
      const next = [...prev, ...processed];
      // Auto-fill title from first photo filename if title is still empty.
      if (prev.length === 0 && next[0] && !formData.title) {
        setFormData((fd) => ({
          ...fd,
          title: next[0]!.file.name.replace(/\.[^/.]+$/, ''),
        }));
      }
      return next;
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (images.length === 0) {
      setError('Please add at least one photo of your collectible.');
      return;
    }
    if (!formData.title.trim()) {
      setError('Please enter a title.');
      return;
    }
    if (!formData.category) {
      setError('Please choose what kind of collectible this is.');
      return;
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        images.forEach((img) => fd.append('images', img.file));
        fd.append('title', formData.title);
        fd.append('category', formData.category);
        fd.append('subcategory', formData.subcategory);
        fd.append('manufacturer', formData.manufacturer);
        fd.append('year', formData.year);
        fd.append('condition', formData.condition);
        fd.append('gradingService', formData.gradingService === '__none__' ? '' : formData.gradingService);
        fd.append('gradingScore', formData.gradingScore);
        fd.append('serialNumber', formData.serialNumber);
        fd.append('description', formData.description);
        fd.append('value', formData.value);
        fd.append('valueIsPublic', String(formData.valueIsPublic));
        fd.append('isPublic', String(formData.isPublic));
        fd.append('location', location ? JSON.stringify(location) : '');

        const result = await createCollectible(fd, userId);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.collectibleId) {
          router.push(`/collectibles/${result.collectibleId}/certificate`);
        }
      } catch (err) {
        console.error('[Collectibles] submit failed', err);
        setError('Something went wrong. Please try again.');
      }
    });
  };

  const atCap = images.length >= MAX_IMAGES;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1 — Photos */}
      <div className="space-y-2">
        <Label htmlFor="images">
          Collectible Photos * <span className="text-ink/50 font-normal text-sm">({images.length}/{MAX_IMAGES})</span>
        </Label>
        <div className="border-2 border-dashed border-wine/30 rounded-lg p-6 bg-parchment/50">
          <input
            ref={fileInputRef}
            type="file"
            id="images"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 font-serif border-wine/30 hover:bg-wine/10"
              disabled={atCap}
              onClick={() => {
                fileInputRef.current?.removeAttribute('capture');
                fileInputRef.current?.click();
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              {images.length === 0 ? 'Choose Photo(s)' : 'Add More Photos'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 font-serif border-wine/30 hover:bg-wine/10"
              disabled={atCap}
              onClick={() => {
                fileInputRef.current?.setAttribute('capture', 'environment');
                fileInputRef.current?.click();
              }}
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
          </div>

          {images.length > 0 ? (
            <div className="space-y-3">
              {/* First photo: large preview with location badge */}
              <div className="relative max-w-xs">
                <button
                  type="button"
                  onClick={() => removeImage(0)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[0]!.previewUrl}
                  alt="Collectible preview"
                  className="w-full h-56 object-cover rounded-lg"
                />
                {location && (
                  <div className="absolute top-2 left-2 bg-wine/90 text-parchment px-2 py-1 rounded text-xs font-serif flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{location.formatted || 'Location detected'}</span>
                  </div>
                )}
              </div>

              {/* Additional photos: thumbnail strip */}
              {images.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {images.slice(1).map((img, i) => (
                    <div key={img.previewUrl} className="relative">
                      <button
                        type="button"
                        onClick={() => removeImage(i + 1)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 z-10"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={`Collectible photo ${i + 2}`}
                        className="w-20 h-20 object-cover rounded-lg border border-wine/20"
                      />
                    </div>
                  ))}
                </div>
              )}

              {!atCap && (
                <p className="text-xs text-ink/50 font-serif">
                  {MAX_IMAGES - images.length} more photo{MAX_IMAGES - images.length === 1 ? '' : 's'} can be added.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-center py-8">
              <p className="text-ink/70 font-serif">Click to upload photos or take one</p>
              <p className="text-xs text-ink/50">PNG, JPG, or WEBP up to 4 MB each. Up to {MAX_IMAGES} photos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Step 2 — Type */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">What kind of collectible? *</Label>
          <Select
            value={formData.category || undefined}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger id="category" className="font-serif">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {COLLECTIBLE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category} className="font-serif">
                  {formatCategoryLabel(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcategory">Subcategory (Optional)</Label>
          <Input
            id="subcategory"
            value={formData.subcategory}
            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
            placeholder="e.g., Baseball, Silver Dollar, Marvel"
            className="font-serif"
          />
        </div>
      </div>

      {/* Step 3 — Details */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., 1952 Topps Mickey Mantle"
          className="font-serif"
          autoComplete="off"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer / Maker (Optional)</Label>
          <Input
            id="manufacturer"
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            placeholder="e.g., Topps, US Mint, Rolex"
            className="font-serif"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Year (Optional)</Label>
          <Input
            id="year"
            type="number"
            inputMode="numeric"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            placeholder="e.g., 1952"
            className="font-serif"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition">Condition (Optional)</Label>
          <Select
            value={formData.condition || '__none__'}
            onValueChange={(value) =>
              setFormData({ ...formData, condition: value === '__none__' ? '' : value })
            }
          >
            <SelectTrigger id="condition" className="font-serif">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="font-serif">
                Not specified
              </SelectItem>
              {COLLECTIBLE_CONDITIONS.map((condition) => (
                <SelectItem key={condition} value={condition} className="font-serif">
                  {formatConditionLabel(condition)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial Number (Optional)</Label>
          <Input
            id="serialNumber"
            value={formData.serialNumber}
            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
            placeholder="e.g., 000123456"
            className="font-serif"
          />
        </div>
      </div>

      {/* Grading */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gradingService">Grading Service (Optional)</Label>
          <Select
            value={formData.gradingService || '__none__'}
            onValueChange={(value) => setFormData({ ...formData, gradingService: value })}
          >
            <SelectTrigger id="gradingService" className="font-serif">
              <SelectValue placeholder="Select grading service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="font-serif">
                Ungraded / Not specified
              </SelectItem>
              {GRADING_SERVICES.map((service) => (
                <SelectItem key={service} value={service} className="font-serif">
                  {service === 'other' ? 'Other' : service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gradingScore">Grade / Score (Optional)</Label>
          <Input
            id="gradingScore"
            value={formData.gradingScore}
            onChange={(e) => setFormData({ ...formData, gradingScore: e.target.value })}
            placeholder="e.g., 9.5, MS-65, Gem Mint"
            className="font-serif"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the collectible, its history, and any notable features..."
          rows={4}
          className="font-serif"
        />
      </div>

      {/* Value */}
      <div className="space-y-2">
        <Label htmlFor="value">Value (Optional)</Label>
        <Input
          id="value"
          value={formData.value}
          onChange={(e) => setFormData({ ...formData, value: e.target.value })}
          placeholder="e.g., $2,500 USD"
          className="font-serif"
        />
        <div className="flex items-center justify-between p-3 border border-wine/20 rounded-lg bg-parchment/50">
          <div className="space-y-0.5">
            <Label htmlFor="valueIsPublic" className="text-sm font-serif">
              Make value public
            </Label>
            <p className="text-xs text-ink/60 font-serif">
              By default, value is private and only visible to you. It always counts toward your
              collection total.
            </p>
          </div>
          <Switch
            id="valueIsPublic"
            checked={formData.valueIsPublic}
            onCheckedChange={(checked) => setFormData({ ...formData, valueIsPublic: checked })}
          />
        </div>
      </div>

      {/* Privacy */}
      <div className="space-y-2 p-4 border border-wine/20 rounded-lg bg-parchment/50">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="isPublic" className="text-base font-serif">
              Make this collectible public
            </Label>
            <p className="text-sm text-ink/60 font-serif">
              Your collection is private by default — only you can see it unless you make it public.
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
          disabled={pending || images.length === 0}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {pending ? 'Creating Certificate…' : 'Create Certificate of Ownership'}
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
