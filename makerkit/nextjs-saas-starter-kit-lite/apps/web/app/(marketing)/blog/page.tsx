import Link from 'next/link';

import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { getPublishedPosts } from '~/lib/blog/posts';

export const revalidate = 120;

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: t('marketing:blog'),
    description: t('marketing:blogSubtitle'),
  };
};

async function BlogIndexPage() {
  const { t } = await createI18nServerInstance();
  const posts = await getPublishedPosts();

  return (
    <div className={'flex flex-col space-y-4 xl:space-y-8'}>
      <SitePageHeader
        title={t('marketing:blog')}
        subtitle={t('marketing:blogSubtitle')}
      />

      <div className={'container flex flex-col space-y-10 pb-16'}>
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-lg">
            <Trans i18nKey={'marketing:noPosts'} />
          </p>
        ) : (
          <ul className="flex max-w-3xl flex-col gap-10">
            {posts.map((post) => {
              const dateLabel = post.published_at
                ? format(new Date(post.published_at), 'MMMM d, yyyy')
                : '';

              return (
                <li
                  key={post.slug}
                  className="border-border flex flex-col gap-3 border-b pb-10 last:border-b-0"
                >
                  <time
                    className="text-muted-foreground text-sm font-medium"
                    dateTime={post.published_at ?? undefined}
                  >
                    {dateLabel}
                  </time>
                  <p className="text-muted-foreground text-sm">By {post.author_name}</p>
                  <h2 className="font-heading text-2xl font-medium tracking-tight dark:text-white">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:text-primary transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  {post.description ? (
                    <p className="text-muted-foreground max-w-2xl leading-relaxed">
                      {post.description}
                    </p>
                  ) : null}
                  <div>
                    <Button asChild variant={'outline'}>
                      <Link href={`/blog/${post.slug}`}>
                        <Trans i18nKey={'marketing:readMore'} />
                        <ArrowRight className={'ml-2 h-4 w-4'} />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default withI18n(BlogIndexPage);
