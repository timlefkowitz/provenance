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
        setStatus('done');
        router.replace(`/artworks/${result.artworkId}/certificate`);
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
        <p className="text-ink/80">Completing your certificate…</p>
      </div>
    );
  }

  if (status === 'done' && artworkId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Success
        </Heading>
        <p className="text-ink/80 mb-6">Redirecting to your certificate…</p>
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
        Claim your certificate
      </Heading>
      <p className="text-ink/80 mb-6">
        Sign in with the email address this invitation was sent to, then we will complete your certificate.
      </p>
      <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
        <Link href={signInHref}>Continue to sign in</Link>
      </Button>
    </div>
  );
}
