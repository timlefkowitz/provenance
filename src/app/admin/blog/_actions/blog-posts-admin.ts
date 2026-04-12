'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isAdmin } from '~/lib/admin';

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers, and single hyphens (e.g. my-new-post).',
  );

const emptyToNull = (val: unknown) =>
  val === '' || val === null || val === undefined ? null : val;

const optionalUrl = z.preprocess(
  emptyToNull,
  z.string().url().nullable().optional(),
);

const optionalCanonical = z.preprocess(
  emptyToNull,
  z.string().max(500).nullable().optional(),
);

const saveBlogPostSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  body_markdown: z.string().min(1),
  status: z.enum(['draft', 'published']),
  author_name: z.string().min(1).max(200),
  og_image_url: optionalUrl,
  canonical_path: optionalCanonical,
  published_at: z.string().optional().nullable(),
});

export type BlogPostAdminRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  published_at: string | null;
  author_name: string;
  author_user_id: string | null;
  updated_at: string;
};

export async function listBlogPostsForAdmin(): Promise<
  { ok: true; posts: BlogPostAdminRow[] } | { ok: false; error: string }
> {
  console.log('[Admin/blog] listBlogPostsForAdmin started');
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return { ok: false, error: 'Unauthorized' };
    }

    const admin = getSupabaseServerAdminClient() as any;
    const { data, error } = await admin
      .from('blog_posts')
      .select(
        'id, slug, title, description, status, published_at, author_name, author_user_id, updated_at',
      )
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Admin/blog] listBlogPostsForAdmin query failed', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, posts: (data ?? []) as BlogPostAdminRow[] };
  } catch (err) {
    console.error('[Admin/blog] listBlogPostsForAdmin failed', err);
    return { ok: false, error: (err as Error).message };
  }
}

export async function getBlogPostForAdmin(
  id: string,
): Promise<
  { ok: true; post: BlogPostAdminRow & { body_markdown: string; og_image_url: string | null; canonical_path: string | null } } | { ok: false; error: string }
> {
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return { ok: false, error: 'Unauthorized' };
    }

    const admin = getSupabaseServerAdminClient() as any;
    const { data, error } = await admin
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[Admin/blog] getBlogPostForAdmin failed', error);
      return { ok: false, error: error.message };
    }
    if (!data) {
      return { ok: false, error: 'Not found' };
    }

    return { ok: true, post: data as BlogPostAdminRow & { body_markdown: string; og_image_url: string | null; canonical_path: string | null } };
  } catch (err) {
    console.error('[Admin/blog] getBlogPostForAdmin failed', err);
    return { ok: false, error: (err as Error).message };
  }
}

export async function getDefaultAuthorNameForAdmin(): Promise<string> {
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return 'Editorial';
    }
    const { data: account } = await client
      .from('accounts')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    const name = (account?.name as string | undefined)?.trim();
    return name && name.length > 0 ? name : 'Editorial';
  } catch (err) {
    console.error('[Admin/blog] getDefaultAuthorNameForAdmin failed', err);
    return 'Editorial';
  }
}

export async function saveBlogPost(
  input: z.infer<typeof saveBlogPostSchema>,
): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string }> {
  console.log('[Admin/blog] saveBlogPost started', { hasId: Boolean(input.id) });
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return { ok: false, error: 'Unauthorized' };
    }

    const parsed = saveBlogPostSchema.safeParse(input);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      console.error('[Admin/blog] saveBlogPost validation failed', msg);
      return {
        ok: false,
        error: Object.values(msg).flat().join('; ') || 'Invalid input',
      };
    }

    const v = parsed.data;
    const ogUrl =
      v.og_image_url && String(v.og_image_url).trim() !== ''
        ? String(v.og_image_url).trim()
        : null;
    const canonical =
      v.canonical_path && String(v.canonical_path).trim() !== ''
        ? String(v.canonical_path).trim()
        : null;

    let publishedAt: string | null = null;
    if (v.status === 'published') {
      if (v.published_at && v.published_at.trim() !== '') {
        const d = new Date(v.published_at);
        if (Number.isNaN(d.getTime())) {
          return { ok: false, error: 'Invalid publish date' };
        }
        publishedAt = d.toISOString();
      } else {
        publishedAt = new Date().toISOString();
      }
    }

    const admin = getSupabaseServerAdminClient() as any;
    const payload = {
      slug: v.slug,
      title: v.title,
      description: v.description?.trim() || null,
      body_markdown: v.body_markdown,
      status: v.status,
      published_at: publishedAt,
      author_name: v.author_name.trim(),
      author_user_id: user.id,
      og_image_url: ogUrl,
      canonical_path: canonical,
    };

    if (v.id) {
      const { data, error } = await admin
        .from('blog_posts')
        .update(payload)
        .eq('id', v.id)
        .select('id, slug')
        .single();

      if (error) {
        console.error('[Admin/blog] saveBlogPost update failed', error);
        return { ok: false, error: error.message };
      }
      console.log('[Admin/blog] saveBlogPost updated', data.id);
      revalidatePath('/blog');
      revalidatePath(`/blog/${data.slug}`);
      revalidatePath('/admin/blog');
      return { ok: true, id: data.id, slug: data.slug };
    }

    const { data, error } = await admin
      .from('blog_posts')
      .insert(payload)
      .select('id, slug')
      .single();

    if (error) {
      console.error('[Admin/blog] saveBlogPost insert failed', error);
      return { ok: false, error: error.message };
    }

    console.log('[Admin/blog] saveBlogPost created', data.id);
    revalidatePath('/blog');
    revalidatePath(`/blog/${data.slug}`);
    revalidatePath('/admin/blog');
    return { ok: true, id: data.id, slug: data.slug };
  } catch (err) {
    console.error('[Admin/blog] saveBlogPost failed', err);
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteBlogPost(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[Admin/blog] deleteBlogPost started', { id });
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return { ok: false, error: 'Unauthorized' };
    }

    const admin = getSupabaseServerAdminClient() as any;
    const { data: row } = await admin
      .from('blog_posts')
      .select('slug')
      .eq('id', id)
      .maybeSingle();

    const { error } = await admin.from('blog_posts').delete().eq('id', id);
    if (error) {
      console.error('[Admin/blog] deleteBlogPost failed', error);
      return { ok: false, error: error.message };
    }

    console.log('[Admin/blog] deleteBlogPost succeeded', { id });
    revalidatePath('/blog');
    if (row?.slug) {
      revalidatePath(`/blog/${row.slug}`);
    }
    revalidatePath('/admin/blog');
    return { ok: true };
  } catch (err) {
    console.error('[Admin/blog] deleteBlogPost failed', err);
    return { ok: false, error: (err as Error).message };
  }
}
