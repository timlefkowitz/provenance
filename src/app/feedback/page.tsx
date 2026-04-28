import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { FeedbackForm } from './_components/feedback-form';

export const metadata = {
  title: 'Feedback | Provenance',
  description:
    'Tell us what is working, what is broken, and what should exist next.',
};

export default async function FeedbackPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in?next=/feedback');
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const defaultName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.display_name === 'string' && meta.display_name) ||
    null;

  return (
    <main className="min-h-screen bg-parchment py-12 sm:py-20">
      <div className="container mx-auto max-w-3xl px-4">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-6 h-20 w-20 overflow-hidden rounded-full border-4 border-wine/15 bg-parchment shadow-sm">
            <Image
              src="/taco-cat.png"
              alt="Taco the cat, the Provenance mascot"
              width={80}
              height={80}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="font-display text-4xl font-bold text-wine sm:text-5xl text-balance">
            Tell us what you think
          </h1>
          <p className="mt-4 font-serif text-lg leading-relaxed text-ink/80 text-pretty">
            Whether it is a bug that bit you, an idea you cannot stop turning
            over, or a sentence of praise — we read all of it. Send it
            anonymously if you prefer.
          </p>
        </header>

        <div className="rounded-xl border border-wine/15 bg-parchment/60 p-6 shadow-sm sm:p-10">
          <FeedbackForm
            defaultEmail={user.email ?? null}
            defaultName={defaultName}
          />
        </div>

        <p className="mt-8 text-center font-serif text-sm text-ink/60">
          Need urgent help instead?{' '}
          <a href="mailto:hello@provenance.guru" className="text-wine underline">
            Email us directly
          </a>
          .
        </p>
      </div>
    </main>
  );
}
