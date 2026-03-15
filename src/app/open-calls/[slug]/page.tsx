import { notFound } from 'next/navigation';
import { getOpenCallBySlug } from '../_actions/get-open-call';
import { isOpenCallSubmissionExpired } from '../_lib/open-call-utils';
import { getCallTypeLabel } from '../_actions/open-call-constants';
import { OpenCallSubmissionForm } from './_components/open-call-submission-form';

export const metadata = {
  title: 'Open Call | Provenance',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function OpenCallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const openCall = await getOpenCallBySlug(slug);

  if (!openCall) {
    notFound();
  }

  const isExpired = isOpenCallSubmissionExpired(openCall);
  const subOpen = openCall.submission_open_date
    ? formatDate(openCall.submission_open_date)
    : null;
  const subClose = openCall.submission_closing_date
    ? formatDate(openCall.submission_closing_date)
    : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <p className="text-sm font-serif text-ink/60">
            {getCallTypeLabel(openCall.call_type ?? 'exhibition')}
          </p>
          {isExpired && (
            <span className="text-xs font-serif px-2 py-0.5 rounded bg-ink/20 text-ink/70">
              Submissions closed
            </span>
          )}
        </div>
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          {openCall.exhibition.title}
        </h1>
        {(subOpen || subClose) && (
          <p className="text-ink/70 font-serif">
            Submissions: {subOpen ?? '—'} – {subClose ?? '—'}
          </p>
        )}
        {openCall.exhibition.location && (
          <p className="text-ink/70 font-serif mt-2">
            {openCall.exhibition.location}
          </p>
        )}
        {openCall.exhibition.description && (
          <p className="text-ink/80 font-serif mt-4">
            {openCall.exhibition.description}
          </p>
        )}
      </div>

      {openCall.external_url ? (
        <div className="rounded-lg border border-wine/30 bg-wine/5 p-6">
          <p className="text-ink/80 font-serif mb-3">
            This is a curated listing. Apply or learn more at the source.
          </p>
          <a
            href={openCall.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-wine px-4 py-2 font-serif text-parchment hover:bg-wine/90"
          >
            View open call
          </a>
        </div>
      ) : (
        <OpenCallSubmissionForm openCallId={openCall.id} isExpired={isExpired} />
      )}
    </div>
  );
}
