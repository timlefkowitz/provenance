import appConfig from '~/config/app.config';

type Props = {
  profileId: string;
  slug: string | null | undefined;
};

export function GalleryPublicLinks({ profileId, slug }: Props) {
  const base = appConfig.url.replace(/\/$/, '');
  return (
    <div className="rounded-md border border-wine/20 bg-parchment/50 px-4 py-3 text-sm font-serif">
      <p className="text-ink/70 font-medium mb-2">Public gallery links</p>
      <ul className="space-y-1.5 text-xs break-all">
        {slug ? (
          <li>
            <span className="text-ink/55">Short: </span>
            <a className="text-wine hover:underline" href={`${base}/g/${encodeURIComponent(slug)}`}>
              {base}/g/{slug}
            </a>
          </li>
        ) : (
          <li className="text-ink/55">Set a public URL slug under Edit profile to get a short link.</li>
        )}
        <li>
          <span className="text-ink/55">Stable: </span>
          <a className="text-wine hover:underline" href={`${base}/gallery/${profileId}`}>
            {base}/gallery/{profileId}
          </a>
        </li>
      </ul>
    </div>
  );
}
