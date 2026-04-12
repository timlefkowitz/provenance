import Link from 'next/link';
import { notFound } from 'next/navigation';

import { format } from 'date-fns';
import { ArrowRight, ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { CtaButton } from '@kit/ui/marketing';
import { Trans } from '@kit/ui/trans';

import { BlogPostMarkdown } from '~/(marketing)/_components/blog-post-markdown';
import appConfig from '~/config/app.config';
import { withI18n } from '~/lib/i18n/with-i18n';
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
    title: post.title,
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
  const datePublished = post.published_at
    ? format(new Date(post.published_at), 'MMMM d, yyyy')
    : '';

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    author: {
      '@type': 'Person',
      name: post.author_name,
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

      <article className="flex flex-col space-y-8 pb-20">
        <div className="border-b py-8 xl:py-10 2xl:py-12">
          <div className="container flex max-w-3xl flex-col space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link
                href="/blog"
                className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
              >
                <Trans i18nKey={'marketing:backToBlog'} />
              </Link>
              <span className="text-muted-foreground" aria-hidden>
                /
              </span>
              <time
                className="text-muted-foreground"
                dateTime={post.published_at ?? undefined}
              >
                {datePublished}
              </time>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground">By {post.author_name}</span>
            </div>
            <h1 className="font-heading text-3xl font-medium tracking-tighter xl:text-5xl dark:text-white">
              {post.title}
            </h1>
            {post.description ? (
              <p className="text-muted-foreground text-lg leading-relaxed tracking-tight 2xl:text-2xl">
                {post.description}
              </p>
            ) : null}
          </div>
        </div>

        {post.og_image_url ? (
          <div className="container max-w-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary OG URLs */}
            <img
              src={post.og_image_url}
              alt={post.title}
              className="border-border aspect-[2/1] w-full rounded-xl border object-cover"
            />
          </div>
        ) : null}

        <div className="container max-w-3xl">
          <BlogPostMarkdown source={post.body_markdown} />
        </div>

        <div className="container max-w-3xl">
          <div className="bg-muted/40 border-border flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm leading-relaxed">
              <Trans i18nKey={'marketing:blogSubtitle'} />
            </p>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <CtaButton variant={'link'}>
                <Link href="/blog">
                  <Trans i18nKey={'marketing:backToBlog'} />
                </Link>
              </CtaButton>
              <CtaButton>
                <Link href="/auth/sign-up">
                  <span className="flex items-center space-x-0.5">
                    <span>
                      <Trans i18nKey={'common:getStarted'} />
                    </span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </Link>
              </CtaButton>
            </div>
          </div>
        </div>

        <div className="container max-w-3xl">
          <Link
            href="/"
            className="text-primary inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
          >
            <Trans i18nKey={'marketing:product'} />
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>
    </>
  );
}

export default withI18n(BlogPostPage);
