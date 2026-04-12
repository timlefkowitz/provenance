import Link from 'next/link';

import { requireAdmin } from '~/lib/admin';
import { getDefaultAuthorNameForAdmin } from '~/app/admin/blog/_actions/blog-posts-admin';
import { BlogPostEditorForm } from '~/app/admin/blog/_components/blog-post-editor-form';

export const metadata = {
  title: 'New blog post | Admin',
};

export default async function AdminBlogNewPage() {
  await requireAdmin();
  const defaultAuthorName = await getDefaultAuthorNameForAdmin();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="mb-6 font-serif text-sm">
        <Link href="/admin/blog" className="text-wine underline">
          ← All posts
        </Link>
      </p>
      <h1 className="mb-8 font-display text-3xl font-bold text-wine">
        New blog post
      </h1>
      <BlogPostEditorForm mode="create" defaultAuthorName={defaultAuthorName} />
    </div>
  );
}
