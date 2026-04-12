import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { formatBlogDate } from '~/lib/blog/format-date';
import { getPublishedPosts } from '~/lib/blog/posts';

export const revalidate = 120;

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: `${t('marketing:blog')} | Provenance`,
    description: t('marketing:blogSubtitle'),
  };
};

async function BlogIndexPage() {
  const { t } = await createI18nServerInstance();
  const posts = await getPublishedPosts();

  return (
    <main className="min-h-screen bg-parchment px-4 py-12 font-serif sm:px-8 sm:py-16">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="border-b-4 border-double border-wine pb-8 text-center">
          <h1 className="font-display text-4xl tracking-wide text-wine sm:text-5xl">
            {t('marketing:blog')}
          </h1>
          <p className="mt-4 font-body text-lg italic text-ink/80">
            {t('marketing:blogSubtitle')}
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-center font-body text-lg text-ink/70">
            <Trans i18nKey="marketing:noPosts" />
          </p>
        ) : (
          <ul className="flex flex-col gap-10">
            {posts.map((post) => (
              <li
                key={post.slug}
                className="flex flex-col gap-3 border-b border-wine/15 pb-10 last:border-b-0"
              >
                <time
                  className="font-body text-sm font-medium text-ink/60"
                  dateTime={post.published_at ?? undefined}
                >
                  {formatBlogDate(post.published_at)}
                </time>
                <h2 className="font-display text-2xl text-wine">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="transition-colors hover:text-wine/80"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.description ? (
                  <p className="max-w-2xl font-body leading-relaxed text-ink/80">
                    {post.description}
                  </p>
                ) : null}
                <div>
                  <Button
                    asChild
                    variant="outline"
                    className="border-wine/40 font-serif text-wine hover:bg-wine/10"
                  >
                    <Link href={`/blog/${post.slug}`}>
                      <Trans i18nKey="marketing:readMore" />
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default withI18n(BlogIndexPage);
