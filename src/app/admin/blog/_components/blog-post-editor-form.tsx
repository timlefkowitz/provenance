'use client';

import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { deleteBlogPost, saveBlogPost } from '../_actions/blog-posts-admin';

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type BlogPostEditorInitial = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body_markdown: string;
  status: string;
  published_at: string | null;
  author_name: string;
  og_image_url: string | null;
  canonical_path: string | null;
};

export function BlogPostEditorForm(props: {
  mode: 'create' | 'edit';
  defaultAuthorName: string;
  initial?: BlogPostEditorInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = props.initial;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const body_markdown = String(formData.get('body_markdown') ?? '');
    const status = String(formData.get('status') ?? 'draft') as
      | 'draft'
      | 'published';
    const author_name = String(formData.get('author_name') ?? '').trim();
    const og_image_url = String(formData.get('og_image_url') ?? '').trim();
    const canonical_path = String(formData.get('canonical_path') ?? '').trim();
    const published_at = String(formData.get('published_at') ?? '').trim();

    startTransition(async () => {
      console.log('[Admin/blog] form submit', { mode: props.mode, slug });
      const res = await saveBlogPost({
        id: initial?.id,
        slug,
        title,
        description: description || null,
        body_markdown,
        status,
        author_name: author_name || props.defaultAuthorName,
        og_image_url: og_image_url || null,
        canonical_path: canonical_path || null,
        published_at: published_at || null,
      });

      if (res.ok) {
        toast.success(
          props.mode === 'create' ? 'Post created' : 'Post saved',
        );
        router.push(`/admin/blog/${res.id}/edit`);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Save failed');
      }
    });
  };

  const onDelete = () => {
    if (!initial?.id) return;
    if (!window.confirm('Delete this post permanently?')) return;
    startTransition(async () => {
      const res = await deleteBlogPost(initial.id);
      if (res.ok) {
        toast.success('Post deleted');
        router.push('/admin/blog');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Delete failed');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-8 font-serif">
      <div className="space-y-2">
        <Label htmlFor="slug">URL slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          defaultValue={initial?.slug ?? ''}
          placeholder="e.g. studio-visit-march"
          className="font-mono text-sm"
        />
        <p className="text-xs text-ink/60">
          Lowercase letters, numbers, and hyphens only. Appears at{' '}
          <span className="font-mono">/blog/your-slug</span>.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={initial?.title ?? ''}
          className="text-lg"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="author_name">Byline (creator name)</Label>
        <Input
          id="author_name"
          name="author_name"
          required
          defaultValue={initial?.author_name ?? props.defaultAuthorName}
          placeholder={props.defaultAuthorName}
        />
        <p className="text-xs text-ink/60">
          Defaults to your account name; change if you want a different byline
          on the public post.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Meta description / excerpt</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ''}
          placeholder="Short summary for SEO and the blog index"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body_markdown">Body (Markdown)</Label>
        <Textarea
          id="body_markdown"
          name="body_markdown"
          required
          rows={22}
          defaultValue={initial?.body_markdown ?? ''}
          className="font-mono text-sm"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            required
            defaultValue={initial?.status ?? 'draft'}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <option value="draft">Draft (not public)</option>
            <option value="published">Published (public)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="published_at">Publish date (optional)</Label>
          <Input
            id="published_at"
            name="published_at"
            type="datetime-local"
            defaultValue={isoToDatetimeLocal(initial?.published_at ?? null)}
          />
          <p className="text-xs text-ink/60">
            If empty when status is Published, the post goes live with the
            current time.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="og_image_url">Social / OG image URL (optional)</Label>
        <Input
          id="og_image_url"
          name="og_image_url"
          type="url"
          defaultValue={initial?.og_image_url ?? ''}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="canonical_path">Canonical path override (optional)</Label>
        <Input
          id="canonical_path"
          name="canonical_path"
          defaultValue={initial?.canonical_path ?? ''}
          placeholder="/blog/your-slug"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="bg-wine text-parchment hover:bg-wine/90"
        >
          {pending ? 'Saving…' : 'Save post'}
        </Button>
        {initial?.slug && initial.status === 'published' ? (
          <Button type="button" variant="outline" asChild>
            <a href={`/blog/${initial.slug}`} target="_blank" rel="noreferrer">
              View live
            </a>
          </Button>
        ) : null}
        {props.mode === 'edit' && initial?.id ? (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}
