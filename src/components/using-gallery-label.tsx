'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@kit/supabase/hooks/use-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Label } from '@kit/ui/label';
import { getPerspective } from './perspective-switcher';
import { getSelectedProfileId } from './profile-switcher';
import { USER_ROLES } from '~/lib/user-roles';
import { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

/**
 * Shows "Using: [Gallery name]" in the hamburger when the user is in Gallery mode.
 * Only renders when perspective is Gallery and the user has at least one gallery profile.
 */
export function UsingGalleryLabel() {
  const { data: user } = useUser();
  const client = useSupabase();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [currentPerspective, setCurrentPerspective] = useState<string>(USER_ROLES.ARTIST);

  // Sync perspective and selected profile from localStorage (e.g. when switched in account dropdown)
  useEffect(() => {
    const sync = () => {
      const p = getPerspective();
      const id = getSelectedProfileId();
      setCurrentPerspective(p);
      setSelectedProfileId(id);
    };
    sync();
    const interval = setInterval(sync, 400);
    return () => clearInterval(interval);
  }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ['user-profiles-gallery-label', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return [];

      const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.sub)
        .eq('role', USER_ROLES.GALLERY)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching gallery profiles:', error);
        return [];
      }

      return (data || []) as UserProfile[];
    },
    enabled: !!user?.sub && currentPerspective === USER_ROLES.GALLERY,
  });

  const currentGalleryName = useMemo(() => {
    if (currentPerspective !== USER_ROLES.GALLERY || profiles.length === 0) return null;
    const selected = selectedProfileId
      ? profiles.find((p) => p.id === selectedProfileId)
      : null;
    const profile = selected ?? profiles[0];
    return profile?.name ?? null;
  }, [currentPerspective, profiles, selectedProfileId]);

  if (currentPerspective !== USER_ROLES.GALLERY || !currentGalleryName) {
    return null;
  }

  return (
    <div className="py-2 border-b border-wine/10">
      <Label className="text-xs font-serif font-semibold text-ink/80 uppercase tracking-wide">
        Using gallery
      </Label>
      <p className="mt-1 font-serif text-sm text-ink" title={currentGalleryName}>
        {currentGalleryName}
      </p>
    </div>
  );
}
