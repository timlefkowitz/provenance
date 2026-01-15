import { Card, CardContent } from '@kit/ui/card';

export function CertificateLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="border-wine/20 bg-parchment/60 animate-pulse">
        <CardContent className="p-8">
          <div className="h-8 bg-wine/20 rounded mb-6 w-3/4" />
          <div className="h-64 bg-parchment/50 rounded mb-6" />
          <div className="space-y-4">
            <div className="h-4 bg-ink/10 rounded w-full" />
            <div className="h-4 bg-ink/10 rounded w-5/6" />
            <div className="h-4 bg-ink/10 rounded w-4/6" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

