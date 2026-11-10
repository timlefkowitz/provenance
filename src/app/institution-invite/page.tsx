import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import pathsConfig from '~/config/paths.config';
import {
  formatTrialLength,
  institutionInvitePath,
} from '~/lib/institutions/institution-invites';
import { asUntyped } from '~/lib/supabase-untyped';

import { getInstitutionInvitePreview } from './_actions/institution-invite';
import { AcceptInstitutionInviteButton } from './_components/accept-institution-invite-button';

export const metadata = {
  title: 'Institution invitation | Provenance',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 font-serif sm:py-16">
      <div className="rounded-xl border border-wine/20 bg-parchment/60 p-6 sm:p-8">{children}</div>
    </div>
  );
}

export default async function InstitutionInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  const preview = token ? await getInstitutionInvitePreview(token.trim()) : null;

  if (!preview) {
    return (
      <Shell>
        <h1 className="mb-2 font-display text-2xl text-wine">Invitation not found</h1>
        <p className="text-ink/80">
          This link isn&apos;t valid. Open the link from your invitation email, or ask your
          Provenance contact to send a new one.
        </p>
      </Shell>
    );
  }

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  const nextPath = institutionInvitePath(token.trim());
  const signInHref = `${pathsConfig.auth.signIn}?next=${encodeURIComponent(nextPath)}`;
  const signUpHref = `${pathsConfig.auth.signUp}?next=${encodeURIComponent(nextPath)}`;
  const trial = formatTrialLength(preview.trialDays);

  return (
    <Shell>
      {preview.institutionPictureUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.institutionPictureUrl}
          alt=""
          className="mb-4 h-14 w-14 rounded-lg border border-wine/15 object-cover"
        />
      )}
      <p className="mb-1 text-xs uppercase tracking-widest text-ink/60">Invitation</p>
      <h1 className="mb-3 font-display text-2xl text-wine sm:text-3xl">
        Join {preview.institutionName} on Provenance
      </h1>

      {preview.status === 'revoked' ? (
        <p className="text-ink/80">
          This invitation was cancelled. Ask your Provenance contact for a new one.
        </p>
      ) : (
        <>
          <p className="mb-4 text-ink/80">
            {preview.status === 'accepted'
              ? 'This invitation has been accepted.'
              : `You've been invited as a team ${preview.teamRole}, with ${trial} free.`}
          </p>
          <ul className="mb-6 space-y-1 text-sm text-ink/70">
            <li>· Your collection, exhibitions, loans and certificates in one place</li>
            <li>· A verified provenance record for every work</li>
            <li>· On the web and in the Provenance iPhone app</li>
          </ul>

          {user ? (
            <AcceptInstitutionInviteButton
              token={token.trim()}
              inviteEmail={preview.email}
              signedInEmail={user.email ?? ''}
              alreadyAccepted={preview.status === 'accepted'}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink/70">
                Sign in or create an account with <strong>{preview.email}</strong> to accept.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="bg-wine text-parchment hover:bg-wine/90">
                  <Link href={signUpHref}>Create account</Link>
                </Button>
                <Button asChild variant="outline" className="border-wine/30">
                  <Link href={signInHref}>I have an account</Link>
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
