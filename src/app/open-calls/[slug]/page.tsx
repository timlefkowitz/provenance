import { notFound } from 'next/navigation';
import { getOpenCallBySlug } from '../_actions/get-open-call';
import { isOpenCallSubmissionExpired } from '../_lib/open-call-utils';
import { getMediumLabel } from '../_actions/open-call-constants';
import { OpenCallSubmissionForm } from './_components/open-call-submission-form';
import { ExhibitionOpenCallSubmit } from './_components/exhibition-open-call-submit';
import { getMyOpenCallStatus } from '~/app/exhibitions/_actions/exhibition-open-call';
import { parseMaxArtworksPerArtist } from '~/app/exhibitions/_helpers/exhibition-invite-limits';
import appConfig from '~/config/app.config';
import { safeJsonLd } from '~/lib/safe-json-ld';
import { cn } from '@kit/ui/utils';
import { BUTTON_PRIMARY, Eyebrow, TAG } from '~/components/editorial-form';
import { EditorialMarkdown } from '~/components/editorial-markdown';
import { stripMarkdown } from '~/lib/strip-markdown';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const openCall = await getOpenCallBySlug(slug);

  if (!openCall) {
    return { title: 'Open Call | Provenance', robots: { index: false, follow: false } };
  }

  const title = `${openCall.exhibition.title} — Open Call | Provenance`;

  const descParts: string[] = [];
  if (openCall.exhibition.description) descParts.push(stripMarkdown(openCall.exhibition.description));
  if (openCall.medium) descParts.push(`Medium: ${getMediumLabel(openCall.medium)}`);
  if (openCall.submission_closing_date) {
    const close = new Date(openCall.submission_closing_date).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    descParts.push(`Deadline: ${close}`);
  }
  if (openCall.exhibition.location) descParts.push(openCall.exhibition.location);
  const description = descParts.join(' · ') || 'Open call for artists on Provenance.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(openCall.image_url ? { images: [{ url: openCall.image_url }] } : {}),
    },
    twitter: {
      card: openCall.image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(openCall.image_url ? { images: [openCall.image_url] } : {}),
    },
  };
}

const DT = 'font-jetbrains text-[10px] uppercase tracking-[0.18em] text-editorial-ink/50';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    // Date-only values parse as UTC midnight; format in UTC so they don't
    // shift to the previous day.
    timeZone: 'UTC',
  });
}

export default async function OpenCallPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { slug } = await params;
  const { submitted } = await searchParams;
  const openCall = await getOpenCallBySlug(slug);

  if (!openCall) {
    notFound();
  }

  const myStatus =
    openCall.submission_mode === 'exhibition' && !openCall.external_url
      ? await getMyOpenCallStatus(openCall.exhibition.id)
      : null;

  const isExpired = isOpenCallSubmissionExpired(openCall);
  const subOpen = openCall.submission_open_date
    ? formatDate(openCall.submission_open_date)
    : null;
  const subClose = openCall.submission_closing_date
    ? formatDate(openCall.submission_closing_date)
    : null;
  const exhibitionStart = formatDate(openCall.exhibition.start_date);
  const exhibitionEnd = openCall.exhibition.end_date
    ? formatDate(openCall.exhibition.end_date)
    : null;
  const dropoff = openCall.dropoff_date ? formatDate(openCall.dropoff_date) : null;

  const pageUrl = new URL(`/open-calls/${openCall.slug}`, appConfig.url).href;
  const openCallJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: openCall.exhibition.title,
    url: pageUrl,
    ...(openCall.exhibition.description
      ? { description: stripMarkdown(openCall.exhibition.description) }
      : {}),
    ...(openCall.image_url ? { image: openCall.image_url } : {}),
    startDate: openCall.exhibition.start_date,
    ...(openCall.exhibition.end_date ? { endDate: openCall.exhibition.end_date } : {}),
    ...(openCall.exhibition.location
      ? { location: { '@type': 'Place', name: openCall.exhibition.location } }
      : {}),
    ...(openCall.submission_closing_date
      ? { registrationDeadline: openCall.submission_closing_date }
      : {}),
    organizer: { '@type': 'Organization', name: 'Provenance', url: appConfig.url },
    isPartOf: { '@type': 'WebSite', name: 'Provenance', url: appConfig.url },
  };

  return (
    <>
      <script
        key="ld:open-call"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(openCallJsonLd) }}
      />
    <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-10">
        <Eyebrow className="mb-5">
          Open call{openCall.medium ? ` · ${getMediumLabel(openCall.medium)}` : ''}
        </Eyebrow>
        {openCall.image_url && (
          <div className="mb-8 aspect-[16/9] overflow-hidden border border-editorial-border/25 bg-cream/50 shadow-editorial">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={openCall.image_url}
              alt={openCall.exhibition.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <h1 className="font-fraunces text-4xl italic leading-[1.05] tracking-tight text-editorial-ink sm:text-5xl">
          {openCall.exhibition.title}
          <span className="text-vermillion">.</span>
        </h1>

        <dl className="mt-6 grid gap-x-8 gap-y-4 border-y border-editorial-border/25 py-4 sm:grid-cols-2">
          <div>
            <dt className={DT}>Exhibition</dt>
            <dd className="mt-1 font-serif text-editorial-ink">
              {exhibitionEnd ? `${exhibitionStart} – ${exhibitionEnd}` : `Opens ${exhibitionStart}`}
            </dd>
          </div>
          {(subOpen || subClose) && (
            <div>
              <dt className={DT}>Submissions</dt>
              <dd className="mt-1 font-serif text-editorial-ink">
                {subOpen ?? '—'} – {subClose ?? '—'}
              </dd>
            </div>
          )}
          {dropoff && (
            <div>
              <dt className={DT}>Artwork drop-off</dt>
              <dd className="mt-1 font-serif text-editorial-ink">{dropoff}</dd>
            </div>
          )}
          {openCall.exhibition.location && (
            <div>
              <dt className={DT}>Location</dt>
              <dd className="mt-1 font-serif text-editorial-ink">{openCall.exhibition.location}</dd>
            </div>
          )}
          {openCall.address && (
            <div className="sm:col-span-2">
              <dt className={DT}>Address</dt>
              <dd className="mt-1 whitespace-pre-line font-serif not-italic text-editorial-ink">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(openCall.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-editorial-border/40 underline-offset-4 transition-colors hover:text-vermillion hover:decoration-vermillion"
                >
                  {openCall.address}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className={DT}>Status</dt>
            <dd className="mt-1.5">
              {isExpired ? (
                <span className={cn(TAG, 'border-editorial-border/30 text-editorial-ink/60')}>
                  Submissions closed
                </span>
              ) : (
                <span className={cn(TAG, 'border-vermillion/40 bg-vermillion/5 text-vermillion')}>
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-vermillion" />
                  Accepting work
                </span>
              )}
            </dd>
          </div>
        </dl>

        {openCall.exhibition.description && (
          <EditorialMarkdown className="mt-6 text-lg">
            {openCall.exhibition.description}
          </EditorialMarkdown>
        )}
      </header>

      {openCall.external_url ? (
        <div className="border border-editorial-border/25 bg-cream/40 p-6">
          <p className="mb-4 font-serif text-editorial-ink/80">
            This is a curated listing. Apply or learn more at the source.
          </p>
          <a
            href={openCall.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(BUTTON_PRIMARY, 'inline-flex items-center hover:bg-vermillion')}
          >
            View open call
          </a>
        </div>
      ) : myStatus ? (
        <ExhibitionOpenCallSubmit
          openCallId={openCall.id}
          slug={openCall.slug}
          exhibitionId={openCall.exhibition.id}
          status={myStatus}
          justSubmitted={submitted === '1'}
          isExpired={isExpired}
          maxArtworks={parseMaxArtworksPerArtist(openCall.exhibition.metadata?.max_artworks_per_artist)}
        />
      ) : (
        <OpenCallSubmissionForm openCallId={openCall.id} isExpired={isExpired} />
      )}
    </div>
    </>
  );
}
