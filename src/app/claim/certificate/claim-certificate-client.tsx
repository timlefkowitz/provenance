'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import pathsConfig from '~/config/paths.config';
import { consumeCertificateClaim } from './_actions/consume-certificate-claim';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

export function ClaimCertificateClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useSupabase();
  const token = searchParams.get('token')?.trim() ?? '';
  const [status, setStatus] = useState<'loading' | 'needs_sign_in' | 'consuming' | 'done' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [artworkId, setArtworkId] = useState<string | null>(null);
  // claimedCount > 1 means this token auto-claimed additional certificates
  const [claimedCount, setClaimedCount] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setError('This link is missing a token. Use the link from your email.');
        setStatus('error');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        setStatus('needs_sign_in');
        return;
      }

      setStatus('consuming');
      console.log('[Certificates] ClaimCertificateClient consuming');
      const result = await consumeCertificateClaim(token);
      if (cancelled) return;

      if (result.success) {
        setArtworkId(result.artworkId);
        if ('claimedCount' in result && typeof result.claimedCount === 'number') {
          setClaimedCount(result.claimedCount);
        }
        setStatus('done');
        // Small delay so the success message is briefly visible before redirect
        setTimeout(() => router.replace(`/artworks/${result.artworkId}/certificate`), 1800);
        return;
      }

      setError(result.error);
      setStatus('error');
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [token, supabase, router]);

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Invalid link
        </Heading>
        <p className="text-ink/80 mb-6">Open the link from your invitation email.</p>
        <Button asChild variant="outline">
          <Link href={pathsConfig.app.home}>Home</Link>
        </Button>
      </div>
    );
  }

  const nextPath = `/claim/certificate?token=${encodeURIComponent(token)}`;
  const signInHref = `${pathsConfig.auth.signIn}?next=${encodeURIComponent(nextPath)}`;

  if (status === 'loading' || status === 'consuming') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <p className="text-ink/80">Completing your certificate{claimedCount > 1 ? 's' : ''}…</p>
      </div>
    );
  }

  if (status === 'done' && artworkId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          {claimedCount > 1 ? `${claimedCount} Certificates Accepted` : 'Certificate Accepted'}
        </Heading>
        <p className="text-ink/80 mb-6">
          {claimedCount > 1
            ? `All ${claimedCount} Certificates of Authenticity have been linked to your account. Redirecting…`
            : 'Your Certificate of Authenticity has been linked to your account. Redirecting…'}
        </p>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90">
          <Link href={`/artworks/${artworkId}/certificate`}>View certificate</Link>
        </Button>
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Could not complete claim
        </Heading>
        <p className="text-ink/80 mb-6">{error}</p>
        <div className="flex flex-col gap-3 items-center">
          <Button asChild variant="outline">
            <Link href={signInHref}>Sign in with the invited email</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={pathsConfig.app.home}>Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
      <Heading level={4} className="text-wine mb-2">
        Accept your certificate{claimedCount > 1 ? 's' : ''}
      </Heading>
      <p className="text-ink/80 mb-2">
        Sign in with the email address this invitation was sent to and we will
        automatically link{' '}
        {claimedCount > 1
          ? 'all your Certificates of Authenticity'
          : 'your Certificate of Authenticity'}{' '}
        to your account.
      </p>
      <p className="text-ink/50 text-sm mb-6">
        Make sure to use the same email address the invitation was sent to.
      </p>
      <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
        <Link href={signInHref}>Continue to sign in</Link>
      </Button>
    </div>
  );
}
