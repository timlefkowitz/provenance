'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { getActiveArtistSubscription } from '~/lib/subscription';

const OPEN_CALL_BUCKET = 'open-call-submissions';

type UploadedArtwork = {
  url: string;
  filename: string;
  contentType: string;
  size: number;
};

export async function submitOpenCall(openCallId: string, formData: FormData) {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();

  const { data: { user } } = await client.auth.getUser();

  if (user) {
    const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);
    if (artistProfile) {
      const artistSubscription = await getActiveArtistSubscription(user.id);
      if (!artistSubscription) {
        return { error: 'An active subscription is required to submit to open calls. Subscribe in Toolbox → Subscription.' };
      }
    }
  }

  const artistName = (formData.get('artistName') as string || '').trim();
  const artistEmail = (formData.get('artistEmail') as string || '').trim();
  const message = (formData.get('message') as string || '').trim();
  const files = formData
    .getAll('artworks')
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!artistName || !artistEmail) {
    return { error: 'Name and email are required.' };
  }

  if (files.length === 0) {
    return { error: 'Please upload at least one artwork image.' };
  }

  const { data: openCall, error: openCallError } = await (admin as any)
    .from('open_calls')
    .select('id, submission_closing_date')
    .eq('id', openCallId)
    .single();

  if (openCallError || !openCall) {
    console.error('[OpenCalls] submitOpenCall: open call not found', openCallError);
    return { error: 'Open call not found.' };
  }

  const closing = openCall.submission_closing_date;
  if (closing) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closeDate = new Date(closing);
    closeDate.setHours(0, 0, 0, 0);
    if (closeDate < today) {
      console.log('[OpenCalls] submitOpenCall: submissions closed', { openCallId });
      return { error: 'Submissions for this open call have closed.' };
    }
  }

  await ensureBucketExists(admin);

  const uploadedArtworks: UploadedArtwork[] = [];
  for (const file of files) {
    const upload = await uploadArtworkFile(admin, openCallId, file);
    uploadedArtworks.push(upload);
  }

  const { error: insertError } = await (admin as any)
    .from('open_call_submissions')
    .insert({
      open_call_id: openCallId,
      account_id: user?.id ?? null,
      artist_name: artistName,
      artist_email: artistEmail,
      message: message || null,
      artworks: uploadedArtworks,
      status: 'submitted',
    });

  if (insertError) {
    console.error('Error creating open call submission:', insertError);
    return { error: insertError.message || 'Failed to submit open call.' };
  }

  return { success: true };
}

async function ensureBucketExists(admin: ReturnType<typeof getSupabaseServerAdminClient>) {
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketExists = buckets?.some((bucket) => bucket.id === OPEN_CALL_BUCKET);

  if (!bucketExists) {
    const { error } = await admin.storage.createBucket(OPEN_CALL_BUCKET, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: 10485760,
    });

    if (error) {
      console.error('Error creating open call bucket:', error);
    }
  }
}

async function uploadArtworkFile(
  admin: ReturnType<typeof getSupabaseServerAdminClient>,
  openCallId: string,
  file: File,
): Promise<UploadedArtwork> {
  const bytes = await file.arrayBuffer();
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `${openCallId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
  const bucket = admin.storage.from(OPEN_CALL_BUCKET);

  const { error: uploadError } = await bucket.upload(fileName, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    console.error('Error uploading open call artwork:', uploadError);
    throw new Error(uploadError.message || 'Failed to upload artwork');
  }

  const { data: urlData } = bucket.getPublicUrl(fileName);
  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded artwork');
  }

  return {
    url: urlData.publicUrl,
    filename: file.name,
    contentType: file.type || 'image/jpeg',
    size: file.size,
  };
}
