import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type BlogPostListItem = {
  slug: string;
  title: string;
  description: string | null;
  published_at: string;
  og_image_url: string | null;
  author_name: string;
};

export type BlogPostDetail = BlogPostListItem & {
  id: string;
  body_markdown: string;
  canonical_path: string | null;
  updated_at: string;
  author_user_id: string | null;
};

export async function getPublishedPosts(): Promise<BlogPostListItem[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('blog_posts')
    .select('slug, title, description, published_at, og_image_url, author_name')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('[Blog] getPublishedPosts failed', error);
    return [];
  }

  return (data ?? []) as BlogPostListItem[];
}

export const getPublishedPostBySlug = cache(
  async (slug: string): Promise<BlogPostDetail | null> => {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('blog_posts')
      .select(
        'id, slug, title, description, published_at, og_image_url, body_markdown, canonical_path, updated_at, author_name, author_user_id',
      )
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('[Blog] getPublishedPostBySlug failed', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return data as BlogPostDetail;
  },
);

export type BlogSitemapEntry = {
  slug: string;
  lastmod: string;
};

export async function getPublishedBlogSitemapEntries(): Promise<
  BlogSitemapEntry[]
> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('blog_posts')
    .select('slug, updated_at, published_at')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('[Blog] getPublishedBlogSitemapEntries failed', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    lastmod: (row.updated_at as string) ?? (row.published_at as string),
  }));
}
