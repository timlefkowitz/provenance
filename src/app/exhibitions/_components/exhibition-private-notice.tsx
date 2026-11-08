import Link from 'next/link';
import { Lock } from 'lucide-react';

import pathsConfig from '~/config/paths.config';

/**
 * Shown in place of a 404 when an exhibition exists but is still a draft (not
 * published) and the viewer can't manage it. Deliberately reveals nothing about
 * the show itself — no title, dates or owner — since drafts are private.
 * Styled after the main navbar: bone ground, editorial ink, vermillion accents,
 * Fraunces italic display and JetBrains Mono small caps.
 */
export function ExhibitionPrivateNotice({
  exhibitionId,
  signedIn,
}: {
  exhibitionId: string;
  signedIn: boolean;
}) {
  const signInHref = `${pathsConfig.auth.signIn}?next=${encodeURIComponent(
    `/exhibitions/${exhibitionId}`,
  )}`;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md border border-editorial-border bg-bone shadow-editorial">
        <div className="px-6 pt-5 pb-3 flex items-center gap-2">
          <span className="font-jetbrains text-[10px] uppercase tracking-[0.2em] text-gilt">
            Exhibition
          </span>
          <span className="flex-1 h-px bg-editorial-border/40" />
        </div>

        <div className="px-6 pb-8 pt-4 text-center">
          <span className="mx-auto mb-6 flex h-12 w-12 items-center justify-center bg-vermillion/10 text-vermillion">
            <Lock className="h-5 w-5" />
          </span>

          <h1 className="font-fraunces italic text-3xl leading-tight tracking-tight text-editorial-ink">
            Not on view yet<span className="text-vermillion">.</span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-editorial-ink/60">
            This exhibition is private or still being prepared. It will appear
            here once the gallery publishes it.
          </p>

          {signedIn ? (
            <p className="mt-3 text-xs leading-relaxed text-editorial-ink/45">
              If you&apos;re on the team, switch to the gallery profile that owns
              this show to see the draft.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-editorial-ink/45">
              Part of the team? Sign in to see the draft.
            </p>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {!signedIn && (
              <Link
                href={signInHref}
                className="inline-flex h-9 items-center justify-center px-4 bg-editorial-ink text-bone hover:bg-vermillion transition-colors font-jetbrains text-[11px] uppercase tracking-[0.14em]"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/exhibitions"
              className="relative inline-flex items-baseline px-1 py-0.5 font-jetbrains text-[11px] font-medium uppercase tracking-[0.18em] text-editorial-ink hover:text-vermillion transition-colors after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:h-[1.5px] after:w-0 hover:after:w-full after:bg-vermillion after:transition-all after:duration-300"
            >
              Browse exhibitions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
