import { Suspense } from 'react';
import { getExhibitionInviteContext } from '../_actions/manage-exhibition-invites';
import { SubmitExhibitionClient } from './submit-exhibition-client';
import { inviteKeyForId } from '~/lib/exhibitions/invite-key';

export const maxDuration = 60;

type PageProps = {
  /** token: from the invite email. invite: an accepted invite, from the artist's show page. */
  searchParams: Promise<{ token?: string; invite?: string }>;
};

export default async function ExhibitionSubmitPage({ searchParams }: PageProps) {
  const { token, invite } = await searchParams;
  const trimmed = token?.trim() || (invite?.trim() ? inviteKeyForId(invite.trim()) : '');

  let inviteContext = null;
  let contextError: string | null = null;

  if (trimmed) {
    const result = await getExhibitionInviteContext(trimmed);
    if (result.valid) {
      inviteContext = {
        exhibitionTitle: result.exhibitionTitle,
        galleryName: result.galleryName,
        issuesCertificateOfShow: result.issuesCertificateOfShow,
        inviteeEmail: result.inviteeEmail,
        inviteeName: result.inviteeName,
        maxArtworks: result.maxArtworks,
        statusPath: result.statusPath,
        straightIn: result.straightIn,
        showType: result.showType,
        workspacePath: result.workspacePath,
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
        inviteKey={trimmed}
        inviteContext={inviteContext}
        contextError={contextError}
      />
    </Suspense>
  );
}
