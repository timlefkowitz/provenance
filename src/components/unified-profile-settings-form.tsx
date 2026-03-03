'use client';

import { useState, useTransition, useEffect, useCallback, memo } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Textarea } from '@kit/ui/textarea';
import { useUpdateAccountData } from '@kit/accounts/hooks/use-update-account';
import { useRevalidatePersonalAccountDataQuery } from '@kit/accounts/hooks/use-personal-account-data';
import { toast } from '@kit/ui/sonner';
import { useTranslation } from 'react-i18next';
import { updateMedium } from '~/app/settings/_actions/update-medium';

export function UnifiedProfileSettingsForm({
  userId,
  currentName,
  currentMedium,
  currentLinks,
  currentGalleries,
}: {
  userId: string;
  currentName: string;
  currentMedium: string;
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
    links: (currentLinks ?? []).slice(0, 3),
    galleriesText: (currentGalleries ?? []).join('\n'),
  });

  // Update form data when props change
  useEffect(() => {
    setFormData({
      name: currentName,
      medium: currentMedium,
      links: (currentLinks ?? []).slice(0, 3),
      galleriesText: (currentGalleries ?? []).join('\n'),
    });
  }, [currentName, currentMedium, currentLinks, currentGalleries]);

  const handleNameChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
    }));
  }, []);

  const handleMediumChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      medium: value,
    }));
  }, []);

  const handleLinkChange = useCallback((index: number, value: string) => {
    setFormData((prev) => {
      const nextLinks = [...prev.links];
      nextLinks[index] = value;
      return {
        ...prev,
        links: nextLinks,
      };
    });
  }, []);

  const handleGalleriesChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      galleriesText: value,
    }));
  }, []);

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
        <NameAndMediumSection
          name={formData.name}
          medium={formData.medium}
          onNameChange={handleNameChange}
          onMediumChange={handleMediumChange}
        />

        <LinksSection
          links={formData.links}
          onLinkChange={handleLinkChange}
        />

        <GalleriesSection
          galleriesText={formData.galleriesText}
          onGalleriesChange={handleGalleriesChange}
        />
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

type NameAndMediumSectionProps = {
  name: string;
  medium: string;
  onNameChange: (value: string) => void;
  onMediumChange: (value: string) => void;
};

const NameAndMediumSection = memo(function NameAndMediumSection({
  name,
  medium,
  onNameChange,
  onMediumChange,
}: NameAndMediumSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Your Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
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
          value={medium}
          onChange={(e) => onMediumChange(e.target.value)}
          placeholder="e.g., Oil on Canvas, Acrylic on Paper, Digital Art"
          className="font-serif"
        />
        <p className="text-sm text-ink/60 font-serif">
          This will be automatically filled in when you create new artworks
        </p>
      </div>
    </div>
  );
});

type LinksSectionProps = {
  links: string[];
  onLinkChange: (index: number, value: string) => void;
};

const LinksSection = memo(function LinksSection({
  links,
  onLinkChange,
}: LinksSectionProps) {
  return (
    <div className="space-y-2">
      <Label>Links (up to 3)</Label>
      <p className="text-xs text-ink/60 font-serif">
        Add links to your website, portfolio, or social profiles.
      </p>
      {[0, 1, 2].map((idx) => (
        <Input
          key={idx}
          value={links[idx] ?? ''}
          onChange={(e) => onLinkChange(idx, e.target.value)}
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
  );
});

type GalleriesSectionProps = {
  galleriesText: string;
  onGalleriesChange: (value: string) => void;
};

const GalleriesSection = memo(function GalleriesSection({
  galleriesText,
  onGalleriesChange,
}: GalleriesSectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="galleries">Galleries (one per line)</Label>
      <Textarea
        id="galleries"
        value={galleriesText}
        onChange={(e) => onGalleriesChange(e.target.value)}
        placeholder={'Gallery Name, City\nAnother Gallery, City\nThird Gallery, Country'}
        rows={4}
        className="font-serif"
      />
      <p className="text-sm text-ink/60 font-serif">
        List galleries you&apos;ve worked with or that represent you.
      </p>
    </div>
  );
});

