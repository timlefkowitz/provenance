'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Heading } from '@kit/ui/heading';
import { toast } from '@kit/ui/sonner';
import pathsConfig from '~/config/paths.config';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { submitExhibitionArtwork } from '../_actions/submit-exhibition-artwork';

type InviteContext = {
  exhibitionTitle: string;
  galleryName: string | null;
  inviteeEmail: string;
  inviteeName: string | null;
};

type SubmitExhibitionClientProps = {
  inviteContext: InviteContext | null;
  contextError: string | null;
};

export function SubmitExhibitionClient({
  inviteContext,
  contextError,
}: SubmitExhibitionClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useSupabase();
  const token = searchParams.get('token')?.trim() ?? '';

  const [authState, setAuthState] = useState<
    'loading' | 'needs_sign_in' | 'ready' | 'done' | 'error'
  >('loading');
  const [error, setError] = useState<string | null>(contextError);
  const [pending, startTransition] = useTransition();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    medium: '',
    creationDate: '',
    dimensions: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!token || contextError) {
        setAuthState('error');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setAuthState('needs_sign_in');
        return;
      }

      if (
        inviteContext &&
        session.user.email &&
        session.user.email.toLowerCase() !== inviteContext.inviteeEmail.toLowerCase()
      ) {
        setError(
          `Sign in with the email this invite was sent to (${inviteContext.inviteeEmail}).`,
        );
        setAuthState('error');
        return;
      }

      setAuthState('ready');
    }

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [token, supabase, inviteContext, contextError]);

  const nextPath = `/exhibitions/submit?token=${encodeURIComponent(token)}`;
  const signInHref = `${pathsConfig.auth.signIn}?next=${encodeURIComponent(nextPath)}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      toast.error('Please add an artwork image');
      return;
    }

    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('title', form.title.trim());
      formData.append('description', form.description.trim());
      formData.append('medium', form.medium.trim());
      formData.append('creationDate', form.creationDate.trim());
      formData.append('dimensions', form.dimensions.trim());

      const result = await submitExhibitionArtwork(token, formData);

      if (result.success) {
        setAuthState('done');
        toast.success('Artwork submitted successfully');
        setTimeout(() => {
          router.replace(`/artworks/${result.artworkId}/certificate`);
        }, 1500);
        return;
      }

      setError(result.error);
      setAuthState('error');
      toast.error(result.error);
    });
  };

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

  if (authState === 'loading') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <p className="text-ink/80">Loading invitation…</p>
      </div>
    );
  }

  if (authState === 'needs_sign_in' && inviteContext) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Submit artwork
        </Heading>
        <p className="text-ink/80 mb-2">
          You&apos;ve been invited to submit work for{' '}
          <strong>{inviteContext.exhibitionTitle}</strong>
          {inviteContext.galleryName ? ` at ${inviteContext.galleryName}` : ''}.
        </p>
        <p className="text-ink/50 text-sm mb-6">
          Sign in with <strong>{inviteContext.inviteeEmail}</strong> to continue.
        </p>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
          <Link href={signInHref}>Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  if (authState === 'done') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Artwork submitted
        </Heading>
        <p className="text-ink/80 mb-6">
          Your Certificate of Authenticity has been created. Redirecting…
        </p>
      </div>
    );
  }

  if (authState === 'error' && error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Could not continue
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

  if (!inviteContext) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8 text-center font-serif">
        <p className="text-[11px] uppercase tracking-widest text-wine/50 mb-2">
          Exhibition submission
        </p>
        <Heading level={3} className="text-wine mb-2">
          {inviteContext.exhibitionTitle}
        </Heading>
        {inviteContext.galleryName && (
          <p className="text-ink/60 text-sm">{inviteContext.galleryName}</p>
        )}
        <p className="text-ink/55 text-sm mt-4 max-w-md mx-auto">
          Upload your artwork to receive a Certificate of Authenticity. The
          gallery will automatically receive a linked Certificate of Show.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 font-serif">
        <div className="space-y-2">
          <Label htmlFor="title">Artwork title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Untitled"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">Artwork image *</Label>
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="medium">Medium</Label>
          <Input
            id="medium"
            value={form.medium}
            onChange={(e) => setForm({ ...form, medium: e.target.value })}
            placeholder="Oil on canvas"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="creationDate">Creation date</Label>
            <Input
              id="creationDate"
              type="date"
              value={form.creationDate}
              onChange={(e) =>
                setForm({ ...form, creationDate: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dimensions">Dimensions</Label>
            <Input
              id="dimensions"
              value={form.dimensions}
              onChange={(e) =>
                setForm({ ...form, dimensions: e.target.value })
              }
              placeholder='24" × 36"'
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            rows={3}
            placeholder="Optional notes about the work"
          />
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-wine text-parchment hover:bg-wine/90"
        >
          {pending ? 'Submitting…' : 'Submit artwork & create COA'}
        </Button>
      </form>
    </div>
  );
}
