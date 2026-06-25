'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { ImageIcon, Heart, Users } from 'lucide-react';
import { ExhibitionDetails } from './exhibition-details';
import { ExhibitionArtistsMedia } from './exhibition-artists-media';
import { ExhibitionMemories } from './exhibition-memories';
import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';
import type { ExhibitionMemory } from '../_actions/exhibition-memories';

export function ExhibitionTabs({
  exhibition,
  isOwner,
  memories,
  canPost,
  currentUserId,
}: {
  exhibition: ExhibitionWithDetails;
  isOwner: boolean;
  memories: ExhibitionMemory[];
  canPost: boolean;
  currentUserId: string | null;
}) {
  const workCount = exhibition.artworks.length;
  const memoryCount = memories.length;

  return (
    <Tabs defaultValue="works" className="w-full">
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
          Artists &amp; Media
        </TabsTrigger>
        <TabsTrigger
          value="memories"
          className="font-serif gap-1.5 data-[state=active]:bg-wine/10 data-[state=active]:text-wine"
        >
          <Heart className="h-3.5 w-3.5" />
          Memories{memoryCount > 0 ? ` · ${memoryCount}` : ''}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="works" className="outline-none">
        {workCount > 0 && (
          <p className="text-[10px] uppercase tracking-widest text-ink/35 font-serif mb-8">
            Works in Exhibition · {workCount}
          </p>
        )}
        <ExhibitionDetails exhibition={exhibition} isOwner={isOwner} />
      </TabsContent>

      <TabsContent value="artists" className="outline-none">
        <ExhibitionArtistsMedia exhibition={exhibition} />
      </TabsContent>

      <TabsContent value="memories" className="outline-none">
        <ExhibitionMemories
          exhibitionId={exhibition.id}
          initialMemories={memories}
          canPost={canPost}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      </TabsContent>
    </Tabs>
  );
}
