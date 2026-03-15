import Link from 'next/link';
import { getOpenCallsList } from '../_actions/get-open-calls-list';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';

export const metadata = {
  title: 'Browse Open Calls | Provenance',
  description: 'Find open calls from galleries and submit your work',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BrowseOpenCallsPage() {
  const openCalls = await getOpenCallsList();

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Open Calls
        </h1>
        <p className="text-ink/70 font-serif">
          Browse open calls from galleries and submit your work to upcoming exhibitions.
        </p>
      </div>

      {openCalls.length === 0 ? (
        <Card className="border-wine/20 bg-parchment/60">
          <CardContent className="p-8 text-center">
            <p className="text-ink/60 font-serif">
              No open calls at the moment. Check back later for new opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {openCalls.map((openCall) => (
            <Card key={openCall.id} className="border-wine/20 bg-parchment/60">
              <CardHeader>
                <CardTitle className="font-display text-xl text-wine">
                  {openCall.exhibition.title}
                </CardTitle>
                {openCall.gallery_name && (
                  <p className="text-sm text-ink/60 font-serif">
                    {openCall.gallery_name}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-ink/70 font-serif">
                  {formatDate(openCall.exhibition.start_date)}
                  {openCall.exhibition.end_date &&
                    ` – ${formatDate(openCall.exhibition.end_date)}`}
                </p>
                {openCall.exhibition.location && (
                  <p className="text-sm text-ink/70 font-serif">
                    {openCall.exhibition.location}
                  </p>
                )}
                {openCall.exhibition.description && (
                  <p className="text-sm text-ink/80 font-serif line-clamp-2">
                    {openCall.exhibition.description}
                  </p>
                )}
                <div className="pt-2">
                  <Button
                    asChild
                    size="sm"
                    className="font-serif bg-wine text-parchment hover:bg-wine/90"
                  >
                    <Link href={`/open-calls/${openCall.slug}`}>
                      View & Submit
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
