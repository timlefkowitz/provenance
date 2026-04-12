import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdmin } from '~/lib/admin';
import {
  getBlogPostForAdmin,
  getDefaultAuthorNameForAdmin,
} from '~/app/admin/blog/_actions/blog-posts-admin';
import { BlogPostEditorForm } from '~/app/admin/blog/_components/blog-post-editor-form';

export const metadata = {
  title: 'Edit blog post | Admin',
};

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const result = await getBlogPostForAdmin(id);
  if (!result.ok) {
    notFound();
  }

  const defaultAuthorName = await getDefaultAuthorNameForAdmin();
  const p = result.post;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="mb-6 font-serif text-sm">
        <Link href="/admin/blog" className="text-wine underline">
          ← All posts
        </Link>
      </p>
      <h1 className="mb-8 font-display text-3xl font-bold text-wine">
        Edit post
      </h1>
      <BlogPostEditorForm
        mode="edit"
        defaultAuthorName={defaultAuthorName}
        initial={{
          id: p.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          body_markdown: p.body_markdown,
          status: p.status,
          published_at: p.published_at,
          author_name: p.author_name,
          og_image_url: p.og_image_url,
          canonical_path: p.canonical_path,
        }}
      />
    </div>
  );
}
