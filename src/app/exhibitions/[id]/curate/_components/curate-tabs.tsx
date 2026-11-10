'use client';

import type { ReactNode } from 'react';
import { ImageIcon, Users } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

/** Works / Artists tabs on the curator view. */
export function CurateTabs({
  defaultTab,
  workCount,
  artistCount,
  works,
  artists,
}: {
  defaultTab: 'works' | 'artists';
  workCount: number;
  artistCount: number;
  works: ReactNode;
  artists: ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="mb-8 flex h-auto min-h-10 w-full flex-wrap items-center justify-start gap-1 border border-wine/20 bg-parchment">
        <TabsTrigger
          value="works"
          className="font-serif gap-1.5 data-[state=active]:bg-wine/10 data-[state=active]:text-wine"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Works{workCount > 0 ? ` · ${workCount}` : ''}
        </TabsTrigger>
        <TabsTrigger
          value="artists"
          className="font-serif gap-1.5 data-[state=active]:bg-wine/10 data-[state=active]:text-wine"
        >
          <Users className="h-3.5 w-3.5" />
          Artists{artistCount > 0 ? ` · ${artistCount}` : ''}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="works">{works}</TabsContent>
      <TabsContent value="artists">{artists}</TabsContent>
    </Tabs>
  );
}
