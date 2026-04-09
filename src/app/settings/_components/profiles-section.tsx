import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { getRoleLabel } from '~/lib/user-roles';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

type Props = {
  profiles: UserProfile[];
};

export function ProfilesSection({ profiles }: Props) {
  return (
    <section id="profiles" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">Profiles</h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Manage your artist and gallery profiles. Bio, location, news, and
          publications are edited per profile.
        </p>
      </div>

      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-wine">Your Profiles</CardTitle>
              <CardDescription className="font-serif">
                Each role profile has its own bio, photo, and press articles.
              </CardDescription>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Link href="/profiles/new">Create Profile</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length > 0 ? (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-wine/15 bg-parchment/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-serif font-medium text-ink">{profile.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className="text-xs border-wine/20 text-wine/80"
                        >
                          {getRoleLabel(profile.role)}
                        </Badge>
                        {profile.location && (
                          <span className="text-xs text-ink/50 font-serif">
                            {profile.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="font-serif border-wine/30 shrink-0"
                  >
                    <Link href={`/profiles/${profile.id}/edit`}>
                      Edit profile & press articles
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-ink/60 font-serif mb-4">
                You haven&apos;t created any profiles yet.
              </p>
              <Button
                asChild
                variant="outline"
                className="font-serif border-wine/30 hover:bg-wine/10"
              >
                <Link href="/profiles/new">Create Your First Profile</Link>
              </Button>
            </div>
          )}
          <p className="text-xs text-ink/55 font-serif pt-3">
            You can also manage profiles from the{' '}
            <Link href="/profiles" className="text-wine underline hover:text-wine/80">
              Manage profiles
            </Link>{' '}
            page in the Toolbox.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
