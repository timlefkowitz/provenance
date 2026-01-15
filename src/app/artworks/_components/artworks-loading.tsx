import { Card, CardContent, CardHeader } from '@kit/ui/card';

export function ArtworksLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="border-wine/20 bg-white overflow-hidden h-full flex flex-col animate-pulse">
          <div className="relative aspect-square bg-parchment/50" />
          <CardHeader className="flex-1">
            <div className="h-5 bg-wine/20 rounded mb-2" />
            <div className="h-4 bg-ink/10 rounded w-2/3" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="h-3 bg-ink/10 rounded w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

