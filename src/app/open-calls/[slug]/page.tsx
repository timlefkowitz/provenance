import { notFound } from 'next/navigation';
import { getOpenCallBySlug } from '../_actions/get-open-call';
import { OpenCallSubmissionForm } from './_components/open-call-submission-form';

export const metadata = {
  title: 'Open Call | Provenance',
};

export default async function OpenCallPage({
  params,
}: {
  params: { slug: string };
}) {
  const openCall = await getOpenCallBySlug(params.slug);

  if (!openCall) {
    notFound();
  }

  const startDate = new Date(openCall.exhibition.start_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const endDate = openCall.exhibition.end_date
    ? new Date(openCall.exhibition.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8">
        <p className="text-sm font-serif text-ink/60 mb-2">Open Call</p>
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          {openCall.exhibition.title}
        </h1>
        <p className="text-ink/70 font-serif">
          {startDate}
          {endDate && ` - ${endDate}`}
        </p>
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

      <OpenCallSubmissionForm openCallId={openCall.id} />
    </div>
  );
}
