'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { Upload, X } from 'lucide-react';
import { createProfile } from '../_actions/create-profile';
import { updateProfile } from '../_actions/update-profile';
import { uploadProfilePicture } from '../_actions/upload-profile-picture';
import { UserProfile } from '../_actions/get-user-profiles';
import { type UserRole } from '~/lib/user-roles';

export function ProfileForm({
  role,
  profile,
}: {
  role?: UserRole;
  profile?: UserProfile;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(profile?.picture_url || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    picture_url: profile?.picture_url || '',
    bio: profile?.bio || '',
    medium: profile?.medium || '',
    location: profile?.location || '',
    website: profile?.website || '',
    links: profile?.links?.join('\n') || '',
    galleries: profile?.galleries?.join('\n') || '',
    contact_email: profile?.contact_email || '',
    phone: profile?.phone || '',
    established_year: profile?.established_year?.toString() || '',
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setUploadingImage(true);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Upload the image using FormData
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      const result = await uploadProfilePicture(uploadFormData);
      
      if (result.error) {
        toast.error(result.error);
        setSelectedFile(null);
        setImagePreview(formData.picture_url || null);
      } else if (result.url) {
        setFormData({ ...formData, picture_url: result.url });
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Failed to upload image');
        setSelectedFile(null);
        setImagePreview(formData.picture_url || null);
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Failed to upload image');
      setSelectedFile(null);
      setImagePreview(formData.picture_url || null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setFormData({ ...formData, picture_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      try {
        // Use uploaded image URL if available, otherwise use the URL input
        const finalPictureUrl = formData.picture_url || undefined;

        if (profile) {
          // Update existing profile
          const result = await updateProfile({
            profileId: profile.id,
            name: formData.name,
            picture_url: finalPictureUrl,
            bio: formData.bio || undefined,
            medium: formData.medium || undefined,
            location: formData.location || undefined,
            website: formData.website || undefined,
            links: formData.links
              ? formData.links.split('\n').filter(l => l.trim())
              : undefined,
            galleries: formData.galleries
              ? formData.galleries.split('\n').filter(g => g.trim())
              : undefined,
            contact_email: formData.contact_email || undefined,
            phone: formData.phone || undefined,
            established_year: formData.established_year ? parseInt(formData.established_year, 10) : undefined,
          });

          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success('Profile updated successfully');
            router.push('/profiles');
            router.refresh();
          }
        } else if (role) {
          // Create new profile
          const result = await createProfile({
            role,
            name: formData.name,
            picture_url: finalPictureUrl,
            bio: formData.bio || undefined,
            medium: formData.medium || undefined,
            location: formData.location || undefined,
            website: formData.website || undefined,
            links: formData.links
              ? formData.links.split('\n').filter(l => l.trim())
              : undefined,
            galleries: formData.galleries
              ? formData.galleries.split('\n').filter(g => g.trim())
              : undefined,
            contact_email: formData.contact_email || undefined,
            phone: formData.phone || undefined,
            established_year: formData.established_year ? parseInt(formData.established_year, 10) : undefined,
          });

          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success('Profile created successfully');
            router.push('/profiles');
            router.refresh();
          }
        }
      } catch (error) {
        console.error('Error saving profile:', error);
        toast.error('An unexpected error occurred');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-xl text-wine">
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div>
            <Label htmlFor="name" className="font-serif">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="font-serif"
              placeholder="Your display name"
            />
          </div>

          {/* Profile Picture */}
          <div>
            <Label className="font-serif mb-2 block">
              Profile Picture
            </Label>
            
            {/* Image Preview */}
            {imagePreview && (
              <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden border-2 border-wine/20 bg-wine/10">
                <Image
                  src={imagePreview}
                  alt="Profile preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-3 mb-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="font-serif border-wine/30 hover:bg-wine/10"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingImage ? 'Uploading...' : 'Upload Photo'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* URL Input (Alternative) */}
            <div>
              <Label htmlFor="picture_url" className="font-serif text-sm text-ink/60">
                Or enter image URL
              </Label>
              <Input
                id="picture_url"
                type="url"
                value={formData.picture_url}
                onChange={(e) => {
                  setFormData({ ...formData, picture_url: e.target.value });
                  if (e.target.value && !selectedFile) {
                    setImagePreview(e.target.value);
                  }
                }}
                className="font-serif mt-1"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio" className="font-serif">
              Biography / Description
            </Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="font-serif"
              placeholder="Tell us about yourself..."
              rows={4}
            />
          </div>

          {/* Medium (for artists) */}
          {(role === 'artist' || profile?.role === 'artist') && (
            <div>
              <Label htmlFor="medium" className="font-serif">
                Medium
              </Label>
              <Input
                id="medium"
                value={formData.medium}
                onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                className="font-serif"
                placeholder="e.g., Oil on canvas, Digital art, Sculpture"
              />
            </div>
          )}

          {/* Location */}
          <div>
            <Label htmlFor="location" className="font-serif">
              Location
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="font-serif"
              placeholder="City, Country"
            />
          </div>

          {/* Established Year (for galleries) */}
          {(role === 'gallery' || profile?.role === 'gallery') && (
            <div>
              <Label htmlFor="established_year" className="font-serif">
                Established Year
              </Label>
              <Input
                id="established_year"
                type="number"
                value={formData.established_year}
                onChange={(e) => setFormData({ ...formData, established_year: e.target.value })}
                className="font-serif"
                placeholder="e.g., 1995"
                min="1000"
                max={new Date().getFullYear()}
              />
            </div>
          )}

          {/* Website */}
          <div>
            <Label htmlFor="website" className="font-serif">
              Website
            </Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="font-serif"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Links (one per line) */}
          <div>
            <Label htmlFor="links" className="font-serif">
              Links (one per line)
            </Label>
            <Textarea
              id="links"
              value={formData.links}
              onChange={(e) => setFormData({ ...formData, links: e.target.value })}
              className="font-serif"
              placeholder="https://instagram.com/yourprofile&#10;https://twitter.com/yourprofile"
              rows={3}
            />
          </div>

          {/* Galleries (for artists) */}
          {(role === 'artist' || profile?.role === 'artist') && (
            <div>
              <Label htmlFor="galleries" className="font-serif">
                Associated Galleries (one per line)
              </Label>
              <Textarea
                id="galleries"
                value={formData.galleries}
                onChange={(e) => setFormData({ ...formData, galleries: e.target.value })}
                className="font-serif"
                placeholder="Gallery Name 1&#10;Gallery Name 2"
                rows={3}
              />
            </div>
          )}

          {/* Contact Email */}
          <div>
            <Label htmlFor="contact_email" className="font-serif">
              Contact Email
            </Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="font-serif"
              placeholder="contact@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone" className="font-serif">
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="font-serif"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {isPending
                ? 'Saving...'
                : profile
                  ? 'Update Profile'
                  : 'Create Profile'}
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
        </CardContent>
      </Card>
    </form>
  );
}

