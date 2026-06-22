import Link from 'next/link';
import { TacoAvatar } from '~/components/taco-avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { UnifiedProfileSettingsForm } from '~/components/unified-profile-settings-form';

type Props = {
  userId: string;
  email: string;
  name: string;
  pictureUrl: string;
  medium: string;
  links: string[];
  galleries: string[];
  firstProfileId: string | null;
};

export function AccountSection({
  userId,
  email,
  name,
  pictureUrl,
  medium,
  links,
  galleries,
  firstProfileId,
}: Props) {
  return (
    <section id="account" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">Account</h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Your account information and public profile details.
        </p>
      </div>

      {/* Avatar & identity */}
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <TacoAvatar
              pictureUrl={pictureUrl}
              displayName={name || 'Profile photo'}
              className="w-16 h-16 rounded-full border-2 border-wine/30 shrink-0"
            />
            <div>
              <CardTitle className="font-display">{name || 'Your Account'}</CardTitle>
              <CardDescription className="font-serif">{email}</CardDescription>
            </div>
          </div>
          {firstProfileId && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="font-serif border-wine/30 w-full sm:w-auto"
            >
              <Link href={`/profiles/${firstProfileId}/edit`}>
                Change profile photo
              </Link>
            </Button>
          )}
        </CardHeader>
      </Card>

      {/* Editable profile fields */}
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-wine">Profile Information</CardTitle>
          <CardDescription className="font-serif">
            Update your name, default medium, links, and gallery affiliations. These
            details appear on your artist page and when people view your artworks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnifiedProfileSettingsForm
            userId={userId}
            currentName={name}
            currentMedium={medium}
            currentLinks={links}
            currentGalleries={galleries}
          />
        </CardContent>
      </Card>
    </section>
  );
}
