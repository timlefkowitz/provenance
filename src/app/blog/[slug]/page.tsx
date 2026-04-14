import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, ArrowRight, ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { BlogPostMarkdown } from '~/components/blog-post-markdown';
import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
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

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium tracking-[0.25em] text-wine/70 uppercase">
      {children}
    </span>
  );
}

async function BlogPostPage(props: PageProps) {
  const { slug } = await props.params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const { t } = await createI18nServerInstance();
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

      <article className="min-h-screen bg-parchment font-body">
        <div className="relative border-b border-wine/10 bg-gradient-to-b from-white/30 to-transparent">
          <div className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:px-10 sm:pt-14 md:pb-20 md:pt-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-ink/55 transition hover:text-wine"
              >
                <ArrowLeft className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
                <Trans i18nKey="marketing:product" />
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-medium text-ink/55 transition hover:text-wine sm:border-l sm:border-wine/15 sm:pl-8"
              >
                <ArrowLeft className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
                <Trans i18nKey="marketing:backToBlog" />
              </Link>
            </div>

            <header className="mt-12 max-w-3xl md:mt-16">
              <SectionEyebrow>{t('marketing:blogIndexEyebrow')}</SectionEyebrow>
              <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-[0.18em] text-ink/45 uppercase">
                <time dateTime={post.published_at ?? undefined}>{datePublished}</time>
                <span className="text-ink/25" aria-hidden>
                  ·
                </span>
                <span className="normal-case tracking-normal text-ink/55">
                  {post.author_name}
                </span>
              </div>
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-wine sm:text-4xl md:text-5xl md:leading-tight">
                {post.title}
              </h1>
              {post.description ? (
                <p className="mt-4 max-w-2xl text-base font-light leading-relaxed text-ink/70 md:text-lg">
                  {post.description}
                </p>
              ) : null}
              <div className="mt-10 h-px max-w-xs bg-gradient-to-r from-wine/40 to-transparent" />
            </header>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 md:py-20">
          <div className="overflow-hidden rounded-2xl border border-wine/10 bg-white/50 shadow-sm ring-1 ring-wine/5">
            {post.og_image_url ? (
              <div className="relative aspect-[16/10] max-h-[min(52vh,32rem)] w-full overflow-hidden bg-wine/[0.06] sm:aspect-[2/1] sm:max-h-none">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary OG URLs */}
                <img
                  src={post.og_image_url}
                  alt={post.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div
                className="flex min-h-[6rem] items-end justify-start bg-gradient-to-br from-wine/[0.12] via-parchment to-wine/[0.04] px-8 pb-6 pt-10 sm:px-10"
                aria-hidden
              >
                <div className="h-px w-12 bg-wine/35" />
              </div>
            )}
            <div className="px-6 py-10 sm:px-10 sm:py-12 md:px-12 md:py-14">
              <BlogPostMarkdown source={post.body_markdown} />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-6 sm:px-10">
          <div className="flex flex-col gap-4 rounded-2xl border border-wine/10 bg-white/40 p-6 shadow-sm ring-1 ring-wine/5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
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

        <div className="mx-auto max-w-6xl px-6 pb-16 pt-4 sm:px-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink/55 underline-offset-4 transition hover:text-wine hover:underline"
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
