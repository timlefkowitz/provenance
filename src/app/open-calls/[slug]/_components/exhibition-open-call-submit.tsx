'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import pathsConfig from '~/config/paths.config';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Eyebrow, TAG } from '~/components/editorial-form';
import {
  startOpenCallSubmission,
  type MyOpenCallStatus,
} from '~/app/exhibitions/_actions/exhibition-open-call';
import {
  artistFacingStatusLabel,
  type ExhibitionArtworkStatus,
} from '~/app/exhibitions/_helpers/exhibition-submission-status';

const PANEL = 'border border-editorial-border/25 bg-cream/40 p-6 font-serif';
const PRIMARY = cn(BUTTON_PRIMARY, 'hover:bg-vermillion');

function statusClass(status: ExhibitionArtworkStatus): string {
  switch (status) {
    case 'submitted':
      return 'border-gilt/60 bg-gilt/10 text-editorial-ink';
    case 'selected':
      return 'border-vermillion/40 bg-vermillion/5 text-vermillion';
    case 'declined':
      return 'border-editorial-border/25 text-editorial-ink/45';
  }
}

/**
 * Open calls attached to an exhibition: artists sign in (or create an
 * account and come straight back here) and submit through the exhibition
 * upload page, where they can upload new work or pick pieces already on
 * their Provenance account. Once submitted, this shows where each work
 * stands in the organiser's review.
 */
export function ExhibitionOpenCallSubmit({
  openCallId,
  slug,
  exhibitionId,
  isExpired,
  maxArtworks,
  status,
  justSubmitted,
}: {
  openCallId: string;
  slug: string;
  exhibitionId: string;
  isExpired: boolean;
  maxArtworks: number | null;
  status: MyOpenCallStatus;
  justSubmitted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const returnPath = `/open-calls/${slug}`;

  if (status.isOrganiser) {
    return (
      <div className={PANEL}>
        <p className="mb-1 text-lg text-editorial-ink">This is your open call.</p>
        <p className="mb-5 text-sm text-editorial-ink/60">
          Share this page with artists. Review what they submit and select works for the
          exhibition from its edit page.
        </p>
        <Button asChild className={PRIMARY}>
          <Link href={`/exhibitions/${exhibitionId}/edit#submissions`}>Review submissions</Link>
        </Button>
      </div>
    );
  }

  const handleStart = () => {
    startTransition(async () => {
      const result = await startOpenCallSubmission(openCallId);
      if (result.success) {
        router.push(`/exhibitions/submit?token=${encodeURIComponent(result.token)}`);
        return;
      }
      if (result.needsSignIn) {
        router.push(`${pathsConfig.auth.signIn}?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      toast.error(result.error);
    });
  };

  const limitText = maxArtworks
    ? `up to ${maxArtworks} ${maxArtworks === 1 ? 'artwork' : 'artworks'}`
    : 'your work';

  let action: React.ReactNode;
  if (isExpired) {
    action = status.submissions.length ? null : (
      <Alert className="rounded-none border-editorial-border/30 bg-cream/40">
        <AlertDescription className="font-serif text-editorial-ink/80">
          Submissions for this open call have closed.
        </AlertDescription>
      </Alert>
    );
  } else if (!status.signedIn) {
    const next = encodeURIComponent(returnPath);
    action = (
      <div className={PANEL}>
        <p className="mb-1 text-lg text-editorial-ink">Submit {limitText} for consideration.</p>
        <p className="mb-5 text-sm text-editorial-ink/60">
          You&apos;ll need a free Provenance account. Once you&apos;re in, you&apos;ll come
          right back here to upload new work or choose pieces already on your account.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild className={PRIMARY}>
            <Link href={`${pathsConfig.auth.signUp}?next=${next}`}>Create an account</Link>
          </Button>
          <Button asChild variant="outline" className={BUTTON_SECONDARY}>
            <Link href={`${pathsConfig.auth.signIn}?next=${next}`}>Sign in</Link>
          </Button>
        </div>
      </div>
    );
  } else if (status.canSubmit) {
    action = (
      <div className={PANEL}>
        <p className="mb-1 text-lg text-editorial-ink">
          {status.submissions.length
            ? 'You can add more work to your submission.'
            : `Submit ${limitText} for consideration.`}
        </p>
        <p className="mb-5 text-sm text-editorial-ink/60">
          Upload new work or choose pieces already on your Provenance account. Each new
          upload gets a Certificate of Authenticity.
        </p>
        <Button
          type="button"
          onClick={handleStart}
          disabled={pending}
          className={PRIMARY}
        >
          {pending ? 'Opening…' : status.submissions.length ? 'Add more work' : 'Submit your work'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {justSubmitted && status.submissions.length > 0 && (
        <Alert className="rounded-none border-vermillion/30 bg-vermillion/5">
          <AlertDescription className="font-serif text-editorial-ink">
            Thanks — your submission is in. The organiser will review it, and you&apos;ll get
            a notification if your work is selected.
          </AlertDescription>
        </Alert>
      )}

      {status.submissions.length > 0 && (
        <section className="border border-editorial-border/25 p-6 font-serif">
          <Eyebrow className="mb-3">Your submission</Eyebrow>
          <ul className="divide-y divide-editorial-border/15">
            {status.submissions.map((submission) => (
              <li key={submission.artworkId} className="flex items-center gap-4 py-3">
                {submission.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={submission.imageUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 object-cover bg-cream/50"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 bg-cream/50" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/artworks/${submission.artworkId}/certificate`}
                    className="block truncate text-editorial-ink transition-colors hover:text-vermillion"
                  >
                    {submission.title}
                  </Link>
                  <p className="text-xs text-editorial-ink/50">
                    Submitted{' '}
                    {new Date(submission.submittedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={cn(TAG, 'shrink-0', statusClass(submission.status))}
                >
                  {artistFacingStatusLabel(submission.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {action}
    </div>
  );
}
