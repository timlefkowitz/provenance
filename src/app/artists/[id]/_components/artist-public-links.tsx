import appConfig from '~/config/app.config';

type Props = {
  /** The account/user id used in the canonical URL `/artists/{userId}`. */
  userId: string;
  /** The artist user_profiles row id, when an artist profile exists. */
  profileId?: string | null;
};

/**
 * Public sharing block for artist profiles. Mirrors `GalleryPublicLinks` so artist
 * owners get the same share-your-profile affordance galleries already have.
 */
export function ArtistPublicLinks({ userId, profileId }: Props) {
  const base = appConfig.url.replace(/\/$/, '');
  const canonical = `${base}/artists/${userId}`;
  const profileUrl = profileId ? `${base}/artists/${profileId}` : null;

  return (
    <div className="rounded-md border border-wine/20 bg-parchment/50 px-4 py-3 text-sm font-serif">
      <p className="text-ink/70 font-medium mb-2">Public artist links</p>
      <ul className="space-y-1.5 text-xs break-all">
        <li>
          <span className="text-ink/55">Canonical: </span>
          <a className="text-wine hover:underline" href={canonical}>
            {canonical}
          </a>
        </li>
        {profileUrl && (
          <li>
            <span className="text-ink/55">Stable: </span>
            <a className="text-wine hover:underline" href={profileUrl}>
              {profileUrl}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
