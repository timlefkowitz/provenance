import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight, ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { BlogPostMarkdown } from '~/components/blog-post-markdown';
import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { formatBlogDate } from '~/lib/blog/format-date';
import { getPublishedPostBySlug } from '~/lib/blog/posts';

export const revalidate = 120;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return {
      title: 'Not found',
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = post.canonical_path?.startsWith('/')
    ? post.canonical_path
    : `/blog/${post.slug}`;

  const canonicalUrl = new URL(canonicalPath, appConfig.url).href;
  const pageUrl = new URL(`/blog/${post.slug}`, appConfig.url).href;

  return {
    metadataBase: new URL(appConfig.url),
    title: `${post.title} | Provenance`,
    description: post.description ?? undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      url: pageUrl,
      title: post.title,
      description: post.description ?? undefined,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      siteName: appConfig.name,
      images: post.og_image_url
        ? [{ url: post.og_image_url, alt: post.title }]
        : undefined,
    },
    twitter: {
      card: post.og_image_url ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.description ?? undefined,
      images: post.og_image_url ? [post.og_image_url] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

async function BlogPostPage(props: PageProps) {
  const { slug } = await props.params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const pageUrl = new URL(`/blog/${post.slug}`, appConfig.url).href;
  const datePublished = formatBlogDate(post.published_at);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    author: {
      '@type': 'Organization',
      name: appConfig.name,
    },
    publisher: {
      '@type': 'Organization',
      name: appConfig.name,
    },
    image: post.og_image_url ? [post.og_image_url] : undefined,
  };

  return (
    <>
      <script
        key="ld:blog-post"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <article className="min-h-screen bg-parchment px-4 pb-20 font-serif sm:px-8">
        <div className="mx-auto max-w-3xl border-b-4 border-double border-wine py-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-sm text-ink/70">
            <Link
              href="/blog"
              className="font-medium text-wine underline-offset-4 hover:underline"
            >
              <Trans i18nKey="marketing:backToBlog" />
            </Link>
            <span aria-hidden>/</span>
            <time dateTime={post.published_at ?? undefined}>
              {datePublished}
            </time>
          </div>
          <h1 className="mt-6 font-display text-4xl tracking-tight text-wine sm:text-5xl">
            {post.title}
          </h1>
          {post.description ? (
            <p className="mt-4 font-body text-lg italic leading-relaxed text-ink/80 sm:text-xl">
              {post.description}
            </p>
          ) : null}
        </div>

        {post.og_image_url ? (
          <div className="mx-auto mt-8 max-w-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary OG URLs */}
            <img
              src={post.og_image_url}
              alt={post.title}
              className="aspect-[2/1] w-full rounded-xl border border-wine/20 object-cover"
            />
          </div>
        ) : null}

        <div className="mx-auto mt-10 max-w-3xl">
          <BlogPostMarkdown source={post.body_markdown} />
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="flex flex-col gap-4 rounded-xl border border-wine/20 bg-wine/5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-sm leading-relaxed text-ink/75">
              <Trans i18nKey="marketing:blogSubtitle" />
            </p>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                asChild
                variant="ghost"
                className="font-serif text-wine hover:bg-wine/10"
              >
                <Link href="/blog">
                  <Trans i18nKey="marketing:backToBlog" />
                </Link>
              </Button>
              <Button
                asChild
                className="bg-wine font-serif text-parchment hover:bg-wine/90"
              >
                <Link href={pathsConfig.auth.signUp}>
                  <span className="flex items-center gap-1">
                    <Trans i18nKey="common:getStarted" />
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-body text-sm font-medium text-wine underline-offset-4 hover:underline"
          >
            <Trans i18nKey="marketing:product" />
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>
    </>
  );
}

export default withI18n(BlogPostPage);
