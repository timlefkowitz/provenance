'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { createProfile } from '../_actions/create-profile';
import { updateProfile } from '../_actions/update-profile';
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
  const [isPending, startTransition] = useTransition();
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
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      try {
        if (profile) {
          // Update existing profile
          const result = await updateProfile({
            profileId: profile.id,
            name: formData.name,
            picture_url: formData.picture_url || undefined,
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
            picture_url: formData.picture_url || undefined,
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

          {/* Picture URL */}
          <div>
            <Label htmlFor="picture_url" className="font-serif">
              Profile Picture URL
            </Label>
            <Input
              id="picture_url"
              type="url"
              value={formData.picture_url}
              onChange={(e) => setFormData({ ...formData, picture_url: e.target.value })}
              className="font-serif"
              placeholder="https://example.com/image.jpg"
            />
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

