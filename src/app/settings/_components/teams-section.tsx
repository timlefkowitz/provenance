import { GalleryMembersManager } from '~/app/profiles/_components/gallery-members-manager';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

type Props = {
  galleryProfiles: UserProfile[];
  userId: string;
};

export function TeamsSection({ galleryProfiles, userId }: Props) {
  if (galleryProfiles.length === 0) return null;

  return (
    <section id="teams" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">Teams</h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Manage the team members who can manage collections, post Certificates
          of Show, and manage exhibitions for your galleries.
        </p>
      </div>

      <div className="space-y-6">
        {galleryProfiles.map((profile) => (
          <div key={profile.id} className="space-y-2">
            <h3 className="text-lg font-display text-wine">
              {profile.name || 'Untitled gallery'}
            </h3>
            <GalleryMembersManager
              galleryProfileId={profile.id}
              userId={userId}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
