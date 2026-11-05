'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';
import { FIELD_HINT, FIELD_INPUT, FIELD_LABEL } from '~/components/editorial-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

type Exhibition = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

export function ExhibitionSelector({
  value,
  onChange,
  userId,
  currentExhibitionId,
  editorial = false,
}: {
  value: string | null;
  onChange: (exhibitionId: string | null) => void;
  userId: string;
  currentExhibitionId?: string | null;
  /** Mono label + hairline trigger, matching the navbar-styled forms. */
  editorial?: boolean;
}) {
  // Fetch user's exhibitions
  const { data: exhibitions = [], isLoading } = useQuery<Exhibition[]>({
    queryKey: ['user-exhibitions', userId],
    queryFn: async () => {
      const response = await fetch(`/api/get-user-exhibitions?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // If there's a current exhibition that's not in the list, we should still show it
  const [_hasCurrentExhibition, setHasCurrentExhibition] = useState(false);

  useEffect(() => {
    if (currentExhibitionId && !exhibitions.find(e => e.id === currentExhibitionId)) {
      setHasCurrentExhibition(true);
    } else {
      setHasCurrentExhibition(false);
    }
  }, [currentExhibitionId, exhibitions]);

  const handleChange = (newValue: string) => {
    if (newValue === '__none__' || newValue === '') {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="exhibition" className={editorial ? FIELD_LABEL : undefined}>Exhibition</Label>
      <Select
        value={value || '__none__'}
        onValueChange={handleChange}
        disabled={isLoading}
      >
        <SelectTrigger id="exhibition" className={editorial ? cn(FIELD_INPUT, 'w-full') : 'font-serif'}>
          <SelectValue placeholder={isLoading ? 'Loading exhibitions...' : 'Select an exhibition (optional)'} />
        </SelectTrigger>
        <SelectContent className={editorial ? 'rounded-none border-editorial-border bg-bone' : undefined}>
          <SelectItem value="__none__" className="font-serif">
            None
          </SelectItem>
          {exhibitions.length > 0 ? (
            exhibitions.map((exhibition) => {
              const startDate = exhibition.start_date ? new Date(exhibition.start_date) : null;
              const endDate = exhibition.end_date ? new Date(exhibition.end_date) : null;
              const now = new Date();
              const isPast = endDate ? endDate < now : startDate ? startDate < now : false;
              
              return (
                <SelectItem key={exhibition.id} value={exhibition.id} className="font-serif">
                  {exhibition.title}
                  {startDate && (
                    <span className="text-xs text-ink/60 ml-2">
                      ({startDate.getFullYear()}{isPast ? ' - Past' : ''})
                    </span>
                  )}
                </SelectItem>
              );
            })
          ) : (
            <SelectItem value="__placeholder__" disabled className="font-serif text-ink/40">
              {isLoading ? 'Loading...' : 'No exhibitions available. Create one in the Exhibitions section.'}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <p className={editorial ? FIELD_HINT : 'text-xs text-ink/60 font-serif'}>
        Link this artwork to an exhibition. Only exhibitions you own are shown.
      </p>
    </div>
  );
}

