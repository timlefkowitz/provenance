'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCurrentUser } from '~/hooks/use-current-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Label } from '@kit/ui/label';
import { getPerspective } from './perspective-switcher';
import { getSelectedProfileId } from './profile-switcher';
import { USER_ROLES } from '~/lib/user-roles';
import { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import type { AppDatabase } from '~/lib/supabase-app-database';

/**
 * Shows "Using: [Gallery name]" in the hamburger when the user is in Gallery mode.
 * Only renders when perspective is Gallery and the user has at least one gallery profile.
 */
export function UsingGalleryLabel() {
  const { data: user } = useCurrentUser();
  const client = useSupabase<AppDatabase>();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
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

    const handleStorage = () => {
      sync();
    };

    const handlePerspectiveChanged = () => {
      sync();
    };

    const handleProfileSelected = () => {
      sync();
    };

    if (typeof window !== 'undefined') {
      // Cross-tab changes
      window.addEventListener('storage', handleStorage);
      // Same-tab perspective changes
      window.addEventListener('user_perspective_changed', handlePerspectiveChanged as EventListener);
      // Same-tab profile selection changes
      window.addEventListener('user_profile_selected', handleProfileSelected as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('user_perspective_changed', handlePerspectiveChanged as EventListener);
        window.removeEventListener('user_profile_selected', handleProfileSelected as EventListener);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.sub || currentPerspective !== USER_ROLES.GALLERY) {
      setProfiles([]);
      return;
    }

    let cancelled = false;
    console.log('[UsingGalleryLabel] Fetching gallery profiles');

    void (async () => {
      try {
        const { data, error } = await client
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.sub)
          .eq('role', USER_ROLES.GALLERY)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (cancelled) return;

        if (error) {
          console.error('[UsingGalleryLabel] Error fetching gallery profiles', error);
          setProfiles([]);
          return;
        }

        console.log('[UsingGalleryLabel] Gallery profiles loaded');
        setProfiles((data || []) as unknown as UserProfile[]);
      } catch (error) {
        if (cancelled) return;
        console.error('[UsingGalleryLabel] Unexpected fetch error', error);
        setProfiles([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, currentPerspective, user?.sub]);

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
