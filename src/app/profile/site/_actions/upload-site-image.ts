'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';

const BUCKET = 'profiles';

export type UploadSiteImageResult =
  | { success: true; url: string }
  | { success: false; error: string };

/**
 * Upload a site asset (hero/banner image) for a creator site.
 * Validates the caller can manage the given profile (own or gallery team).
 * Uses the existing 'profiles' storage bucket under sites/<profile_id>/.
 */
export async function uploadSiteImage(
  profileId: string,
  formData: FormData,
): Promise<UploadSiteImageResult> {
  console.log('[Sites] uploadSiteImage start', { profileId });

  try {
    const client = getSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return { success: false, error: 'No file provided' };
    }
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }
    if (file.size > 8 * 1024 * 1024) {
      return { success: false, error: 'Image size must be less than 8MB' };
    }

    const sb = client as any;
    const { data: profile } = await sb
      .from('user_profiles')
      .select('id, user_id, role')
      .eq('id', profileId)
      .maybeSingle();

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    let hasAccess = profile.user_id === user.id;
    if (!hasAccess && profile.role === 'gallery') {
      hasAccess = await canManageGallery(user.id, profileId);
    }
    if (!hasAccess) {
      return { success: false, error: 'You do not have permission to upload to this profile' };
    }

    // Ensure bucket exists (mirrors uploadProfilePicture pattern)
    try {
      const adminClient = getSupabaseServerAdminClient();
      const { data: buckets } = await adminClient.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.id === BUCKET);
      if (!bucketExists) {
        await adminClient.storage.createBucket(BUCKET, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          fileSizeLimit: 8388608,
        });
      }
    } catch (bucketErr) {
      console.error('[Sites] uploadSiteImage bucket check failed', bucketErr);
    }

    const bytes = await file.arrayBuffer();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `sites/${profileId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const bucket = client.storage.from(BUCKET);
    const { error: uploadErr } = await bucket.upload(fileName, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadErr) {
      console.error('[Sites] uploadSiteImage upload failed', uploadErr);
      return { success: false, error: `Upload failed: ${uploadErr.message}` };
    }

    const { data: urlData } = bucket.getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      return { success: false, error: 'Could not resolve public URL' };
    }

    console.log('[Sites] uploadSiteImage uploaded', { profileId, url: urlData.publicUrl });
    return { success: true, url: urlData.publicUrl };
  } catch (err) {
    console.error('[Sites] uploadSiteImage failed', err);
    return { success: false, error: (err as Error).message };
  }
}
