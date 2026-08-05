import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { formatBlogDate } from '~/lib/blog/format-date';
import { getPublishedPosts } from '~/lib/blog/posts';
import type { BlogPostListItem } from '~/lib/blog/posts';
import { SiteLegalFooter } from '~/components/legal/site-legal-footer';

export const revalidate = 120;

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: `${t('marketing:blog')} | Provenance`,
    description: t('marketing:blogSubtitle'),
  };
};

function MonoLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`font-[family-name:var(--font-jetbrains)] text-[0.65rem] uppercase tracking-[0.18em] ${className}`}
    >
      {children}
    </span>
  );
}

function PostMeta({ post }: { post: BlogPostListItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <MonoLabel className="text-editorial-ink/50">
        <time dateTime={post.published_at ?? undefined}>
          {formatBlogDate(post.published_at)}
        </time>
      </MonoLabel>
      <span className="text-editorial-ink/25 font-[family-name:var(--font-jetbrains)] text-[0.65rem]">·</span>
      <MonoLabel className="text-editorial-ink/60 normal-case tracking-normal">
        {post.author_name}
      </MonoLabel>
    </div>
  );
}

function FeaturedPostCard({ post, index }: { post: BlogPostListItem; index: number }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid grid-cols-1 md:grid-cols-12 hairline-b"
    >
      {/* Left: metadata */}
      <div className="col-span-12 md:col-span-5 hairline-b md:hairline-b-0 md:hairline-r p-6 md:p-10 flex flex-col justify-between gap-8">
        <div>
          <MonoLabel className="text-gilt">
            Featured Entry № {String(index + 1).padStart(3, '0')}
          </MonoLabel>
          <h2 className="mt-4 font-[family-name:var(--font-fraunces)] font-light italic text-4xl md:text-6xl leading-[0.92] tracking-[-0.03em] text-editorial-ink group-hover:text-vermillion transition-colors duration-200">
            {post.title}
          </h2>
          {post.description ? (
            <p className="mt-5 font-[family-name:var(--font-inter-tight)] text-base leading-relaxed text-editorial-ink/65">
              {post.description}
            </p>
          ) : null}
        </div>

        <div>
          <dl className="space-y-2.5 mb-6">
            {[
              ['Author', post.author_name],
              ['Filed', formatBlogDate(post.published_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-editorial-border/30 pb-2">
                <dt><MonoLabel className="text-editorial-ink/45">{k}</MonoLabel></dt>
                <dd><MonoLabel className="text-editorial-ink">{v}</MonoLabel></dd>
              </div>
            ))}
          </dl>
          <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-jetbrains)] text-[0.65rem] uppercase tracking-[0.18em] text-editorial-ink border-b border-editorial-ink pb-0.5 group-hover:text-vermillion group-hover:border-vermillion transition-colors duration-200">
            Read the full entry →
          </span>
        </div>
      </div>

      {/* Right: image */}
      <div className="col-span-12 md:col-span-7 relative bg-cream min-h-[32vh] md:min-h-[400px]">
        {post.og_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.og_image_url}
            alt={post.title}
            className="w-full h-full object-cover absolute inset-0"
          />
        ) : (
          <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-cream via-bone to-cream/50" />
        )}
        <div className="absolute top-4 left-4">
          <MonoLabel className="bg-bone px-2.5 py-1.5 text-editorial-ink">
            Provenance · The Journal
          </MonoLabel>
        </div>
        <div className="absolute bottom-4 right-4">
          <MonoLabel className="bg-editorial-ink text-bone px-2.5 py-1.5 flex items-center gap-1.5">
            Read <ArrowUpRight className="h-3 w-3" />
          </MonoLabel>
        </div>
      </div>
    </Link>
  );
}

function ArchivePostCard({ post, index }: { post: BlogPostListItem; index: number }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col p-6 md:p-8 min-h-[220px] hover:bg-cream transition-colors duration-200"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <PostMeta post={post} />
        <MonoLabel className="text-editorial-ink/30 shrink-0">
          № {String(index + 1).padStart(2, '0')}
        </MonoLabel>
      </div>
      <h2 className="font-[family-name:var(--font-fraunces)] font-light italic text-2xl md:text-3xl leading-tight tracking-[-0.02em] text-editorial-ink group-hover:text-vermillion transition-colors duration-200 flex-1">
        {post.title}
      </h2>
      {post.description ? (
        <p className="mt-3 font-[family-name:var(--font-inter-tight)] text-sm leading-relaxed text-editorial-ink/60 line-clamp-2">
          {post.description}
        </p>
      ) : null}
      <div className="mt-4">
        <MonoLabel className="text-editorial-ink/40 group-hover:text-vermillion transition-colors duration-200">
          Read →
        </MonoLabel>
      </div>
    </Link>
  );
}

async function BlogIndexPage() {
  console.log('[Blog] BlogIndexPage render started');
  const { t } = await createI18nServerInstance();
  const posts = await getPublishedPosts();
  const [featured, ...rest] = posts;
  console.log('[Blog] BlogIndexPage loaded posts', { total: posts.length });

  return (
    <main className="grain min-h-screen bg-bone text-editorial-ink font-[family-name:var(--font-inter-tight)]">

      {/* Folio hero header */}
      <div className="relative hairline-b">
        <div className="grid grid-cols-12">
          {/* Left rail */}
          <aside className="hidden md:flex col-span-2 hairline-r p-5 flex-col justify-between min-h-[56vh]">
            <MonoLabel className="text-editorial-ink/50">Vol. I / Folio 001</MonoLabel>
            <div className="space-y-2">
              <MonoLabel className="block text-editorial-ink/50">Est. MMXXIII</MonoLabel>
              <MonoLabel className="block text-editorial-ink/50">The Journal</MonoLabel>
            </div>
          </aside>

          {/* Center content */}
          <div className="col-span-12 md:col-span-8 p-6 md:p-10 flex flex-col justify-center">
            <MonoLabel className="text-editorial-ink/55 mb-6 block">
              {t('marketing:blogIndexEyebrow', { defaultValue: 'Notes on Art, Objects & Their Histories' })}
            </MonoLabel>
            <h1 className="font-[family-name:var(--font-fraunces)] font-light italic text-[16vw] md:text-[9vw] leading-[0.85] tracking-[-0.04em] text-editorial-ink">
              The Journal<span className="text-vermillion">.</span>
            </h1>
            <p className="mt-8 max-w-2xl font-[family-name:var(--font-inter-tight)] text-lg leading-relaxed text-editorial-ink/70">
              {t('marketing:blogSubtitle', { defaultValue: 'Writing on provenance, conservation, collecting, and the biographies of objects.' })}
            </p>
          </div>

          {/* Right rail */}
          <aside className="hidden md:flex col-span-2 hairline-l p-5 flex-col justify-between min-h-[56vh]">
            <MonoLabel className="text-right text-editorial-ink/50">
              Filed under<br />Essays / Notes
            </MonoLabel>
            <MonoLabel className="text-editorial-ink/40 text-right">
              provenance.guru/<br />blog
            </MonoLabel>
          </aside>
        </div>
      </div>

      {/* Posts */}
      <div>
        {posts.length === 0 ? (
          <div className="p-10 md:p-20 flex items-center justify-center">
            <div className="border border-editorial-border px-8 py-12 text-center max-w-md">
              <MonoLabel className="text-editorial-ink/40 block mb-3">No entries yet</MonoLabel>
              <p className="font-[family-name:var(--font-fraunces)] italic text-2xl text-editorial-ink/60">
                <Trans i18nKey="marketing:noPosts" />
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Featured post */}
            {featured ? (
              <section aria-labelledby="blog-featured-heading">
                <h2 id="blog-featured-heading" className="sr-only">
                  {t('marketing:blogLatestScreenReader', { defaultValue: 'Latest post' })}
                </h2>
                <FeaturedPostCard post={featured} index={0} />
              </section>
            ) : null}

            {/* Archive grid */}
            {rest.length > 0 ? (
              <section aria-labelledby="blog-archive-heading">
                {/* Archive header */}
                <div className="hairline-b p-6 md:p-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <MonoLabel className="text-gilt block mb-2">
                      {t('marketing:blogArchiveEyebrow', { defaultValue: 'All Entries' })}
                    </MonoLabel>
                    <h2
                      id="blog-archive-heading"
                      className="font-[family-name:var(--font-fraunces)] font-light italic text-4xl md:text-5xl leading-tight tracking-[-0.03em] text-editorial-ink"
                    >
                      {t('marketing:blogArchiveHeading', { defaultValue: 'Further Reading.' })}
                    </h2>
                  </div>
                  <MonoLabel className="text-editorial-ink/45 max-w-xs text-right">
                    {rest.length} {rest.length === 1 ? 'entry' : 'entries'} in the archive
                  </MonoLabel>
                </div>

                {/* Grid */}
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post, i) => (
                    <li
                      key={post.slug}
                      className={[
                        'hairline-b',
                        // right border: all except last in each row
                        'md:[&:not(:nth-child(2n))]:hairline-r',
                        'lg:hairline-r lg:[&:nth-child(3n)]:border-r-0',
                      ].join(' ')}
                    >
                      <ArchivePostCard post={post} index={i + 1} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      <SiteLegalFooter />
    </main>
  );
}

export default withI18n(BlogIndexPage);
