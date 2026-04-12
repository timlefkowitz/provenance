import Link from 'next/link';

import { Button } from '@kit/ui/button';

import { requireAdmin } from '~/lib/admin';
import { listBlogPostsForAdmin } from '~/app/admin/blog/_actions/blog-posts-admin';

export const metadata = {
  title: 'Blog posts | Admin',
};

export default async function AdminBlogListPage() {
  await requireAdmin();
  const result = await listBlogPostsForAdmin();

  if (!result.ok) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <p className="text-red-700 font-serif">
          Could not load posts: {result.error}
        </p>
      </div>
    );
  }

  const { posts } = result;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 font-display text-4xl font-bold text-wine">
            Blog posts
          </h1>
          <p className="font-serif text-ink/70">
            Create and edit marketing blog posts. Only admins see this page.
            Public posts appear at{' '}
            <Link href="/blog" className="text-wine underline">
              /blog
            </Link>
            .
          </p>
        </div>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90">
          <Link href="/admin/blog/new">New post</Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <p className="font-serif text-ink/70">No posts yet.</p>
      ) : (
        <ul className="space-y-3 font-serif">
          {posts.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 border-4 border-double border-wine/30 bg-parchment px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{p.title}</p>
                <p className="text-sm text-ink/60">
                  <span className="font-mono">/{p.slug}</span>
                  <span className="mx-2">·</span>
                  <span
                    className={
                      p.status === 'published' ? 'text-green-800' : 'text-ink/50'
                    }
                  >
                    {p.status}
                  </span>
                  <span className="mx-2">·</span>
                  <span>By {p.author_name}</span>
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/blog/${p.id}/edit`}>Edit</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
