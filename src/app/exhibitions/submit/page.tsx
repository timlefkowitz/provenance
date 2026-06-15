import { Suspense } from 'react';
import { getExhibitionInviteContext } from '../_actions/manage-exhibition-invites';
import { SubmitExhibitionClient } from './submit-exhibition-client';

export const maxDuration = 60;

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ExhibitionSubmitPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const trimmed = token?.trim() ?? '';

  let inviteContext = null;
  let contextError: string | null = null;

  if (trimmed) {
    const result = await getExhibitionInviteContext(trimmed);
    if (result.valid) {
      inviteContext = {
        exhibitionTitle: result.exhibitionTitle,
        galleryName: result.galleryName,
        inviteeEmail: result.inviteeEmail,
        inviteeName: result.inviteeName,
      };
    } else {
      contextError = result.error;
    }
  } else {
    contextError = 'This link is missing a token. Use the link from your email.';
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif text-ink/80">
          Loading…
        </div>
      }
    >
      <SubmitExhibitionClient
        inviteContext={inviteContext}
        contextError={contextError}
      />
    </Suspense>
  );
}
