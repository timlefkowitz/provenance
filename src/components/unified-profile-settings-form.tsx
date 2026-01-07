'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { useUpdateAccountData } from '@kit/accounts/hooks/use-update-account';
import { useRevalidatePersonalAccountDataQuery } from '@kit/accounts/hooks/use-personal-account-data';
import { toast } from '@kit/ui/sonner';
import { useTranslation } from 'react-i18next';
import { updateMedium } from '~/app/settings/_actions/update-medium';

export function UnifiedProfileSettingsForm({
  userId,
  currentName,
  currentMedium,
}: {
  userId: string;
  currentName: string;
  currentMedium: string;
  currentCv?: string;
  currentLinks?: string[];
  currentGalleries?: string[];
}) {
  const { t } = useTranslation('account');
  const updateAccountMutation = useUpdateAccountData(userId);
  const revalidateUserDataQuery = useRevalidatePersonalAccountDataQuery();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: currentName,
    medium: currentMedium,
    cv: (currentCv ?? '').toString(),
    links: (currentLinks ?? []).slice(0, 3),
    galleriesText: (currentGalleries ?? []).join('\n'),
  });

  // Update form data when props change
  useEffect(() => {
    setFormData({
      name: currentName,
      medium: currentMedium,
      cv: (currentCv ?? '').toString(),
      links: (currentLinks ?? []).slice(0, 3),
      galleriesText: (currentGalleries ?? []).join('\n'),
    });
  }, [currentName, currentMedium, currentCv, currentLinks, currentGalleries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        // Update account name and medium in parallel
        const galleriesArray = formData.galleriesText
          .split('\n')
          .map((g) => g.trim())
          .filter(Boolean);

        const [nameResult, mediumResult] = await Promise.allSettled([
          updateAccountMutation.mutateAsync({
            name: formData.name,
          }),
          updateMedium({
            medium: formData.medium,
            cv: formData.cv,
            links: formData.links,
            galleries: galleriesArray,
          }),
        ]);

        // Check for errors
        if (nameResult.status === 'rejected') {
          throw nameResult.reason;
        }
        if (mediumResult.status === 'rejected') {
          const error = mediumResult.reason as { error?: string };
          if (error?.error) {
            throw new Error(error.error);
          }
          throw mediumResult.reason;
        }

        // Revalidate user data
        revalidateUserDataQuery(userId);

        setSuccess(true);
        toast.success(t('updateProfileSuccess'));
        setTimeout(() => setSuccess(false), 3000);
      } catch (e: any) {
        const errorMessage = e?.message || t('updateProfileError');
        setError(errorMessage);
        toast.error(errorMessage);
      }
    });
  };

  const isPending = pending || updateAccountMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>Profile settings updated successfully!</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Your name"
            minLength={2}
            maxLength={100}
            className="font-serif"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="medium">Default Medium</Label>
          <Input
            id="medium"
            value={formData.medium}
            onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
            placeholder="e.g., Oil on Canvas, Acrylic on Paper, Digital Art"
            className="font-serif"
          />
          <p className="text-sm text-ink/60 font-serif">
            This will be automatically filled in when you create new artworks
          </p>
        </div>

        {/* CV */}
        <div className="space-y-2">
          <Label htmlFor="cv">Artist CV / Bio</Label>
          <Textarea
            id="cv"
            value={formData.cv}
            onChange={(e) =>
              setFormData({ ...formData, cv: e.target.value })
            }
            placeholder="Share your background, education, exhibitions, or a short CV. You can also paste a link to an external CV here."
            rows={5}
            className="font-serif"
          />
          <p className="text-sm text-ink/60 font-serif">
            This appears on your public artist profile.
          </p>
        </div>

        {/* Links */}
        <div className="space-y-2">
          <Label>Links (up to 3)</Label>
          <p className="text-xs text-ink/60 font-serif">
            Add links to your website, portfolio, or social profiles.
          </p>
          {[0, 1, 2].map((idx) => (
            <Input
              key={idx}
              value={formData.links[idx] ?? ''}
              onChange={(e) => {
                const next = [...formData.links];
                next[idx] = e.target.value;
                setFormData({ ...formData, links: next });
              }}
              placeholder={
                idx === 0
                  ? 'https://your-website.com'
                  : idx === 1
                  ? 'https://instagram.com/your-handle'
                  : 'https://link-three.com'
              }
              className="font-serif"
            />
          ))}
        </div>

        {/* Galleries */}
        <div className="space-y-2">
          <Label htmlFor="galleries">Galleries (one per line)</Label>
          <Textarea
            id="galleries"
            value={formData.galleriesText}
            onChange={(e) =>
              setFormData({ ...formData, galleriesText: e.target.value })
            }
            placeholder={'Gallery Name, City\nAnother Gallery, City\nThird Gallery, Country'}
            rows={4}
            className="font-serif"
          />
          <p className="text-sm text-ink/60 font-serif">
            List galleries you&apos;ve worked with or that represent you.
          </p>
        </div>
      </div>

      <div className="pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {isPending ? 'Saving...' : 'Save Profile Settings'}
        </Button>
      </div>
    </form>
  );
}

