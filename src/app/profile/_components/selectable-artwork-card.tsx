'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardHeader } from '@kit/ui/card';
import { Checkbox } from '@kit/ui/checkbox';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
};

export function SelectableArtworkCard({
  artwork,
  isSelected,
  onSelectChange,
}: {
  artwork: Artwork;
  isSelected: boolean;
  onSelectChange: (artworkId: string, selected: boolean) => void;
}) {
  return (
    <Card
      className={`group hover:shadow-lg transition-all duration-300 border-wine/20 hover:border-wine/40 bg-white overflow-hidden h-full flex flex-col relative cursor-pointer ${
        isSelected ? 'ring-2 ring-wine border-wine' : ''
      }`}
      onClick={() => onSelectChange(artwork.id, !isSelected)}
    >
      <div className="absolute top-2 left-2 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => {
            onSelectChange(artwork.id, checked as boolean);
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white border-wine/30"
        />
      </div>
      <Link
        href={`/artworks/${artwork.id}/certificate`}
        className="cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-square bg-parchment overflow-hidden">
          {artwork.image_url ? (
            <Image
              src={artwork.image_url}
              alt={artwork.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink/30 font-serif">
              No Image
            </div>
          )}
        </div>
      </Link>
      <CardHeader className="flex-1">
        <Link
          href={`/artworks/${artwork.id}/certificate`}
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-display font-bold text-wine text-lg mb-1 line-clamp-2 group-hover:text-wine/80 transition-colors">
            {artwork.title}
          </h3>
        </Link>
        {artwork.artist_name && (
          <p className="text-ink/70 font-serif text-sm">
            {artwork.artist_name}
          </p>
        )}
      </CardHeader>
    </Card>
  );
}

