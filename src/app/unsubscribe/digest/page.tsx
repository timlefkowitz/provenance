import { verifyUnsubscribeToken } from '~/lib/email-preferences';
import { unsubscribeDigest } from './_actions/unsubscribe-digest';

export const metadata = {
  title: 'Unsubscribe | Provenance',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ token?: string; status?: string }> };

/**
 * Landing page for the digest's unsubscribe link. Opening the link changes
 * nothing (mail scanners open links); the person must press the button.
 */
export default async function UnsubscribeDigestPage({ searchParams }: Props) {
  const { token, status } = await searchParams;

  let heading = 'Unsubscribe from the weekly digest';
  let body = 'You will stop receiving the weekly grants and open calls email. Other emails, like receipts and certificates, are not affected.';
  let showForm = Boolean(verifyUnsubscribeToken(token));

  if (status === 'done') {
    heading = "You're unsubscribed";
    body = "You won't receive the weekly digest anymore. Sorry to see you go.";
    showForm = false;
  } else if (status === 'error') {
    heading = 'Something went wrong';
    body = "We couldn't update your preference. Please try the link in your email again.";
    showForm = false;
  } else if (!showForm) {
    heading = 'This link is not valid';
    body = 'The unsubscribe link is incomplete or has been altered. Please use the link from your email.';
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-wine/15 bg-white p-8 shadow-sm">
        <p className="text-[11px] uppercase tracking-widest text-wine/50 font-serif mb-2">Provenance</p>
        <h1 className="font-display text-2xl font-bold text-ink mb-3">{heading}</h1>
        <p className="font-serif text-sm text-ink/70 mb-6">{body}</p>
        {showForm && (
          <form action={unsubscribeDigest}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="rounded-md bg-wine px-5 py-2.5 text-sm font-serif text-parchment hover:bg-wine/90"
            >
              Unsubscribe
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
