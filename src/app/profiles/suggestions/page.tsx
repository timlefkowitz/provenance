import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getMyProfileSuggestions } from '../_actions/profile-suggestions';
import { ProfileSuggestionReview } from '../_components/profile-suggestion-review';
import { ProfileUpdateRequestsList } from '../_components/profile-update-requests-list';
import { getMyIncomingProfileUpdateRequests } from '~/app/artists/[id]/_actions/profile-update-requests';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Suggested profile updates | Provenance',
};

/**
 * Curators who show an artist's work can suggest updates to the artist's
 * profile (bio, statement, photo, CV, press). The artist picks what to keep.
 */
export default async function ProfileSuggestionsPage() {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  if (!user) redirect('/auth/sign-in?next=/profiles/suggestions');

  const [suggestions, requests] = await Promise.all([
    getMyProfileSuggestions(),
    getMyIncomingProfileUpdateRequests(),
  ]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-4xl font-bold text-wine">Suggested profile updates</h1>
        <p className="font-serif text-ink/70">
          Curators showing your work can suggest updates to your profile. Choose what to add, edit it
          first if you like, or decline. Nothing changes until you accept.
        </p>
      </div>
      {requests.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 font-display text-2xl text-wine">Requests to update your profile</h2>
          <p className="mb-5 font-serif text-sm text-ink/70">
            Galleries, collectors and curators asked you to add or refresh parts of your profile. Open each item to
            update it, then mark the request done so they know, or dismiss it.
          </p>
          <ProfileUpdateRequestsList requests={requests} />
        </section>
      )}
      {suggestions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-wine/15 py-16 text-center font-serif text-sm text-ink/40">
          No suggestions waiting for you.
        </p>
      ) : (
        <div className="space-y-8">
          {suggestions.map((s) => (
            <ProfileSuggestionReview key={s.id} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
}
