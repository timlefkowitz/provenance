'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import pathsConfig from '~/config/paths.config';
import type { HandoffPreview } from '~/lib/profile-handoff/handoff';
import { acceptProfileHandoff, declineProfileHandoff } from './_actions/accept-profile-handoff';

export function AcceptProfileHandoffClient({
  token,
  preview,
  signedInEmail,
}: {
  token: string;
  preview: HandoffPreview;
  signedInEmail: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ role: 'artist' | 'collector'; works: number } | null>(null);
  const [declined, setDeclined] = useState(false);

  const nextPath = `/claim/profile?token=${encodeURIComponent(token)}`;
  const signInHref = `${pathsConfig.auth.signIn}?next=${encodeURIComponent(nextPath)}`;
  const signUpHref = `${pathsConfig.auth.signUp}?next=${encodeURIComponent(nextPath)}`;

  if (!preview.ok) {
    return (
      <Shell title="Invite unavailable">
        <p className="text-ink/80 mb-6">{preview.error}</p>
        <Button asChild variant="outline">
          <Link href={pathsConfig.app.home}>Home</Link>
        </Button>
      </Shell>
    );
  }

  const isArtist = preview.role === 'artist';
  const worksLine = preview.works === 1 ? '1 work' : `${preview.works} works`;
  const from = preview.fromName || 'Someone';

  if (done) {
    const doneWorks = done.works === 1 ? '1 work' : `${done.works} works`;
    return (
      <Shell title={isArtist ? 'Certificates accepted' : 'Collection accepted'}>
        <p className="text-ink/80 mb-6">
          {isArtist
            ? `${doneWorks} with Certificates of Authenticity are now in your account, under your artist profile.`
            : `${doneWorks} with Certificates of Ownership are now in your collector profile.`}
        </p>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90">
          <Link href="/profiles">Go to your profiles</Link>
        </Button>
      </Shell>
    );
  }

  if (declined) {
    return (
      <Shell title="Invite declined">
        <p className="text-ink/80 mb-6">
          {from} has been told. Nothing was added to your account.
        </p>
        <Button asChild variant="outline">
          <Link href={pathsConfig.app.home}>Home</Link>
        </Button>
      </Shell>
    );
  }

  const invitedAs = preview.recipientName
    ? `${preview.recipientName}'s Provenance account`
    : preview.inviteeEmail ?? 'the invited email';

  const title = isArtist ? 'Accept your Certificates of Authenticity' : 'Accept your collection';
  const intro = isArtist
    ? `${from} posted ${worksLine} under your name, ${preview.name}, and issued a Certificate of Authenticity for each. Accepting makes them your own certificates, held in your account and not tied to any gallery or collector.`
    : `${from} catalogued ${worksLine} for "${preview.name}", each with a Certificate of Ownership. Accepting moves the collection into your own account.`;

  if (!signedInEmail) {
    return (
      <Shell title={title}>
        <p className="text-ink/80 mb-2">{intro}</p>
        <p className="text-ink/60 text-sm mb-6">
          {preview.recipientName ? (
            <>Sign in to <strong>{invitedAs}</strong> to accept or decline.</>
          ) : (
            <>Sign in or create an account with <strong>{invitedAs}</strong> to accept or decline.</>
          )}
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Button asChild className="bg-wine text-parchment hover:bg-wine/90">
            <Link href={signUpHref}>Create an account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={signInHref}>I already have an account</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (preview.isForViewer === false) {
    return (
      <Shell title={title}>
        <p className="text-ink/80 mb-6">
          This invite was sent to <strong>{invitedAs}</strong>, but you are signed in as{' '}
          <strong>{signedInEmail}</strong>. Switch accounts to accept it.
        </p>
        <Button asChild variant="outline">
          <Link href={signInHref}>Switch account</Link>
        </Button>
      </Shell>
    );
  }

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptProfileHandoff(token);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone({ role: result.role, works: result.works });
      router.refresh();
    });
  };

  const handleDecline = () => {
    setError(null);
    startTransition(async () => {
      const result = await declineProfileHandoff({ token });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDeclined(true);
    });
  };

  return (
    <Shell title={title}>
      <p className="text-ink/80 mb-6">{intro}</p>
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onClick={handleAccept}
          disabled={isPending}
          className="bg-wine text-parchment hover:bg-wine/90"
        >
          {isPending ? 'Working…' : isArtist ? 'Accept certificates' : 'Accept collection'}
        </Button>
        <Button variant="outline" onClick={handleDecline} disabled={isPending}>
          Decline
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
      <Heading level={4} className="text-wine mb-3">
        {title}
      </Heading>
      {children}
    </div>
  );
}
