import Link from 'next/link';

import { ArrowLeft, ArrowUpRight } from 'lucide-react';

import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { formatBlogDate } from '~/lib/blog/format-date';
import { getPublishedPosts } from '~/lib/blog/posts';
import type { BlogPostListItem } from '~/lib/blog/posts';

export const revalidate = 120;

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: `${t('marketing:blog')} | Provenance`,
    description: t('marketing:blogSubtitle'),
  };
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium tracking-[0.25em] text-wine/70 uppercase">
      {children}
    </span>
  );
}

function PostMeta({ post }: { post: BlogPostListItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-xs font-medium tracking-[0.18em] text-ink/45 uppercase">
      <time dateTime={post.published_at ?? undefined}>
        {formatBlogDate(post.published_at)}
      </time>
      <span aria-hidden className="text-ink/25">
        ·
      </span>
      <span className="normal-case tracking-normal text-ink/55">
        {post.author_name}
      </span>
    </div>
  );
}

function FeaturedPostCard({ post }: { post: BlogPostListItem }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-wine/10 bg-white/50 shadow-sm ring-1 ring-wine/5 transition duration-300 hover:shadow-md hover:ring-wine/12 lg:flex-row lg:items-stretch"
    >
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-wine/[0.06] lg:aspect-auto lg:w-[min(44%,28rem)]">
        {post.og_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary OG URLs from CMS
          <img
            src={post.og_image_url}
            alt=""
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full min-h-[12rem] items-end justify-start bg-gradient-to-br from-wine/[0.12] via-parchment to-wine/[0.04] p-6 lg:min-h-full"
            aria-hidden
          >
            <div className="h-px w-12 bg-wine/35" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-4 p-8 md:p-10 lg:pl-12 lg:pr-14">
        <PostMeta post={post} />
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-wine transition group-hover:text-wine/85 md:text-3xl lg:text-[2rem] lg:leading-snug">
            {post.title}
          </h2>
          <span
            className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-wine/15 bg-parchment/80 text-wine opacity-80 transition group-hover:border-wine/25 group-hover:opacity-100"
            aria-hidden
          >
            <ArrowUpRight className="size-4" strokeWidth={1.75} />
          </span>
        </div>
        {post.description ? (
          <p className="max-w-2xl font-body text-base font-light leading-relaxed text-ink/70 md:text-lg">
            {post.description}
          </p>
        ) : null}
        <span className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-wine underline-offset-4 group-hover:underline">
          <Trans i18nKey="marketing:readMore" />
        </span>
      </div>
    </Link>
  );
}

function CompactPostCard({ post }: { post: BlogPostListItem }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-wine/10 bg-white/40 shadow-sm ring-1 ring-wine/5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-wine/12"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-wine/[0.05]">
        {post.og_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary OG URLs from CMS
          <img
            src={post.og_image_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center bg-gradient-to-br from-wine/10 via-transparent to-wine/[0.06]"
            aria-hidden
          >
            <div className="h-px w-10 bg-wine/30" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6 md:p-7">
        <PostMeta post={post} />
        <h2 className="font-display text-xl font-semibold tracking-tight text-wine transition group-hover:text-wine/85">
          {post.title}
        </h2>
        {post.description ? (
          <p className="line-clamp-3 flex-1 font-body text-sm font-light leading-relaxed text-ink/65">
            {post.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <span className="inline-flex items-center gap-1 font-body text-sm font-medium text-wine">
          <Trans i18nKey="marketing:readMore" />
          <ArrowUpRight className="size-3.5 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
        </span>
      </div>
    </Link>
  );
}

async function BlogIndexPage() {
  const { t } = await createI18nServerInstance();
  const posts = await getPublishedPosts();
  const [featured, ...rest] = posts;

  return (
    <main className="min-h-screen bg-parchment font-body">
      <div className="relative border-b border-wine/10 bg-gradient-to-b from-white/30 to-transparent">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:px-10 sm:pt-14 md:pb-20 md:pt-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-body text-sm font-medium text-ink/55 transition hover:text-wine"
          >
            <ArrowLeft className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
            <Trans i18nKey="marketing:product" />
          </Link>

          <header className="mt-12 max-w-3xl md:mt-16">
            <SectionEyebrow>{t('marketing:blogIndexEyebrow')}</SectionEyebrow>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl md:tracking-tight">
              {t('marketing:blog')}
            </h1>
            <p className="mt-4 max-w-xl text-base font-light leading-relaxed text-ink/60 md:text-lg">
              {t('marketing:blogSubtitle')}
            </p>
            <div className="mt-10 h-px max-w-xs bg-gradient-to-r from-wine/40 to-transparent" />
          </header>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 md:py-20">
        {posts.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-wine/20 bg-white/30 px-8 py-16 text-center ring-1 ring-wine/5">
            <p className="font-body text-lg font-light text-ink/65">
              <Trans i18nKey="marketing:noPosts" />
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-14 md:gap-20">
            {featured ? (
              <section aria-labelledby="blog-featured-heading">
                <h2 id="blog-featured-heading" className="sr-only">
                  {t('marketing:blogLatestScreenReader')}
                </h2>
                <FeaturedPostCard post={featured} />
              </section>
            ) : null}

            {rest.length > 0 ? (
              <section aria-labelledby="blog-archive-heading">
                <div className="mb-8 flex flex-col gap-2 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <SectionEyebrow>{t('marketing:blogArchiveEyebrow')}</SectionEyebrow>
                    <h2
                      id="blog-archive-heading"
                      className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink"
                    >
                      {t('marketing:blogArchiveHeading')}
                    </h2>
                  </div>
                  <p className="max-w-sm text-sm font-light text-ink/50">
                    {t('marketing:blogSubtitle')}
                  </p>
                </div>
                <ul className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
                  {rest.map((post) => (
                    <li key={post.slug}>
                      <CompactPostCard post={post} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

export default withI18n(BlogIndexPage);
