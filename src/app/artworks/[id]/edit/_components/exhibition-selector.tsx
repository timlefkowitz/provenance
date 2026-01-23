'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@kit/ui/label';
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
}: {
  value: string | null;
  onChange: (exhibitionId: string | null) => void;
  userId: string;
  currentExhibitionId?: string | null;
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
  const [hasCurrentExhibition, setHasCurrentExhibition] = useState(false);

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
      <Label htmlFor="exhibition">Exhibition</Label>
      <Select
        value={value || '__none__'}
        onValueChange={handleChange}
        disabled={isLoading}
      >
        <SelectTrigger id="exhibition" className="font-serif">
          <SelectValue placeholder={isLoading ? 'Loading exhibitions...' : 'Select an exhibition (optional)'} />
        </SelectTrigger>
        <SelectContent>
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
      <p className="text-xs text-ink/60 font-serif">
        Link this artwork to an exhibition. Only exhibitions you own are shown.
      </p>
    </div>
  );
}

