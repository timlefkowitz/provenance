import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

import { Trans } from '@kit/ui/trans';

import { BlogPostMarkdown } from '~/components/blog-post-markdown';
import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { formatBlogDate } from '~/lib/blog/format-date';
import { safeJsonLd } from '~/lib/safe-json-ld';
import { getPublishedPostBySlug } from '~/lib/blog/posts';
import { SiteLegalFooter } from '~/components/legal/site-legal-footer';

import { asUntyped } from '~/lib/supabase-untyped';
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

function MonoLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`font-[family-name:var(--font-jetbrains)] text-[0.65rem] uppercase tracking-[0.18em] ${className}`}
    >
      {children}
    </span>
  );
}

async function BlogPostPage(props: PageProps) {
  console.log('[Blog] BlogPostPage render started');
  const { slug } = await props.params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  console.log('[Blog] BlogPostPage loaded post', { slug: post.slug });

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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      />

      <article className="grain min-h-screen bg-bone text-editorial-ink font-[family-name:var(--font-inter-tight)]">

        {/* Page header with breadcrumbs and post meta */}
        <div className="hairline-b">
          <div className="grid grid-cols-12">
            {/* Left rail */}
            <aside className="hidden md:flex col-span-2 hairline-r p-5 flex-col justify-between min-h-[44vh]">
              <MonoLabel className="text-editorial-ink/50">Vol. I / Folio</MonoLabel>
              <MonoLabel className="text-editorial-ink/40">The Journal</MonoLabel>
            </aside>

            {/* Main header content */}
            <div className="col-span-12 md:col-span-8 p-6 md:p-10 flex flex-col justify-between gap-8">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-0">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 group"
                >
                  <ArrowLeft className="h-3 w-3 text-editorial-ink/40 group-hover:text-vermillion transition-colors" strokeWidth={1.75} />
                  <MonoLabel className="text-editorial-ink/50 group-hover:text-vermillion transition-colors">
                    <Trans i18nKey="marketing:product" />
                  </MonoLabel>
                </Link>
                <span className="mx-4 text-editorial-border font-[family-name:var(--font-jetbrains)] text-[0.65rem]">/</span>
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-1.5 group"
                >
                  <ArrowLeft className="h-3 w-3 text-editorial-ink/40 group-hover:text-vermillion transition-colors" strokeWidth={1.75} />
                  <MonoLabel className="text-editorial-ink/50 group-hover:text-vermillion transition-colors">
                    <Trans i18nKey="marketing:backToBlog" />
                  </MonoLabel>
                </Link>
              </div>

              {/* Post header */}
              <div className="max-w-3xl">
                <MonoLabel className="text-gilt block mb-3">
                  {t('marketing:blogIndexEyebrow', { defaultValue: 'The Journal' })}
                </MonoLabel>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-4">
                  <MonoLabel className="text-editorial-ink/45">
                    <time dateTime={post.published_at ?? undefined}>
                      Filed {datePublished}
                    </time>
                  </MonoLabel>
                  <span className="text-editorial-ink/25 font-[family-name:var(--font-jetbrains)] text-[0.65rem]">·</span>
                  <MonoLabel className="text-editorial-ink/55 normal-case tracking-normal">
                    {post.author_name}
                  </MonoLabel>
                </div>
                <h1 className="font-[family-name:var(--font-fraunces)] font-light italic text-3xl sm:text-4xl md:text-5xl leading-[0.92] tracking-[-0.035em] text-editorial-ink">
                  {post.title}
                </h1>
                {post.description ? (
                  <p className="mt-4 text-lg font-[family-name:var(--font-inter-tight)] font-medium leading-relaxed text-editorial-ink/80 max-w-2xl">
                    {post.description}
                  </p>
                ) : null}
              </div>

              {/* Hairline rule */}
              <div className="h-px bg-editorial-border/40 max-w-xs" />
            </div>

            {/* Right rail */}
            <aside className="hidden md:flex col-span-2 hairline-l p-5 flex-col justify-between min-h-[44vh]">
              <MonoLabel className="text-right text-editorial-ink/45">
                Filed under<br />Essays
              </MonoLabel>
              <MonoLabel className="text-editorial-ink/35 text-right">
                {datePublished}
              </MonoLabel>
            </aside>
          </div>
        </div>

        {/* Hero image block */}
        {post.og_image_url ? (
          <div className="relative hairline-b bg-cream">
            <div className="relative aspect-[16/9] max-h-[min(55vh,36rem)] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.og_image_url}
                alt={post.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute top-4 left-4">
                <MonoLabel className="bg-bone px-2.5 py-1.5 text-editorial-ink">
                  Provenance · The Journal
                </MonoLabel>
              </div>
              <div className="absolute bottom-4 right-4">
                <MonoLabel className="bg-editorial-ink text-bone px-2.5 py-1.5">
                  Published ✓
                </MonoLabel>
              </div>
            </div>
          </div>
        ) : (
          <div className="hairline-b">
            <div className="flex min-h-[6rem] items-end justify-start bg-cream px-8 pb-6 pt-10 md:px-10">
              <div className="h-px w-12 bg-editorial-border/40" />
            </div>
          </div>
        )}

        {/* Article body */}
        <div className="p-6 md:p-10">
          <div className="border border-editorial-border/30 bg-cream p-6 md:p-10 lg:p-12">
            <BlogPostMarkdown source={post.body_markdown} />
          </div>
        </div>

        {/* Bottom CTA strip */}
        <div className="hairline bg-editorial-ink text-bone">
          <div className="p-6 md:p-10">
            <MonoLabel className="text-gilt block mb-6">
              Provenance · The Journal
            </MonoLabel>
            <p className="font-[family-name:var(--font-fraunces)] font-light italic text-3xl md:text-5xl leading-tight tracking-[-0.03em] text-bone max-w-2xl mb-8">
              <Trans i18nKey="marketing:blogSubtitle" defaults="Writing on provenance, conservation, collecting, and the biographies of objects." />
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/blog"
                className="px-5 py-3 border border-bone/60 font-[family-name:var(--font-jetbrains)] text-[0.65rem] uppercase tracking-[0.18em] text-bone hover:bg-bone hover:text-editorial-ink transition-colors duration-200 inline-flex items-center gap-2"
              >
                <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
                <Trans i18nKey="marketing:backToBlog" />
              </Link>
              <Link
                href={pathsConfig.auth.signUp}
                className="px-5 py-3 bg-bone text-editorial-ink font-[family-name:var(--font-jetbrains)] text-[0.65rem] uppercase tracking-[0.18em] hover:bg-vermillion hover:text-bone transition-colors duration-200 inline-flex items-center gap-2"
              >
                <Trans i18nKey="common:getStarted" />
                <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>

        <SiteLegalFooter className="border-t-0 pt-0" />
      </article>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default withI18n(BlogPostPage as any);
