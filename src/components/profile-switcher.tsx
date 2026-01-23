'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@kit/supabase/hooks/use-user';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';
import { UserProfile } from '~/app/profiles/_actions/get-user-profiles';
import { getPerspective } from './perspective-switcher';
import { USER_ROLES, getRoleLabel } from '~/lib/user-roles';

const SELECTED_PROFILE_KEY = 'selected_profile_id';

export function ProfileSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { data: user } = useUser();
  const client = useSupabase();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [currentPerspective, setCurrentPerspective] = useState<string>(USER_ROLES.ARTIST);

  // Load selected profile and perspective from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SELECTED_PROFILE_KEY);
      if (saved) {
        setSelectedProfileId(saved);
      }
      const perspective = getPerspective();
      setCurrentPerspective(perspective);
    }
  }, []);

  // Fetch all user profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['user-profiles', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return [];

      const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.sub)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching profiles:', error);
        return [];
      }

      return (data || []) as UserProfile[];
    },
    enabled: !!user?.sub,
  });

  // Filter profiles by current perspective/role
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => p.role === currentPerspective);
  }, [profiles, currentPerspective]);

  // Validate and auto-select profile
  useEffect(() => {
    // Check if selected profile is still valid for current perspective
    if (selectedProfileId) {
      const isValid = filteredProfiles.some(p => p.id === selectedProfileId);
      if (!isValid) {
        // Selected profile is not valid for current perspective, clear it
        setSelectedProfileId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(SELECTED_PROFILE_KEY);
        }
      }
    }
    
    // Auto-select first profile if none selected and there's only one
    if (filteredProfiles.length === 1 && !selectedProfileId) {
      const firstProfile = filteredProfiles[0];
      setSelectedProfileId(firstProfile.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(SELECTED_PROFILE_KEY, firstProfile.id);
      }
    }
  }, [filteredProfiles, selectedProfileId]);

  // Update perspective when it changes in localStorage
  useEffect(() => {
    const checkPerspective = () => {
      const perspective = getPerspective();
      if (perspective !== currentPerspective) {
        setCurrentPerspective(perspective);
        // Clear selected profile when perspective changes
        setSelectedProfileId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(SELECTED_PROFILE_KEY);
        }
      }
    };

    // Listen for storage changes (when perspective switcher updates in another tab)
    window.addEventListener('storage', checkPerspective);
    
    // Also check periodically (since same-tab updates don't trigger storage event)
    const interval = setInterval(checkPerspective, 300);

    return () => {
      window.removeEventListener('storage', checkPerspective);
      clearInterval(interval);
    };
  }, [currentPerspective]);

  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(SELECTED_PROFILE_KEY, profileId);
    }
    
    // Refresh to apply profile changes
    router.refresh();
  };

  // Don't render if no user or no profiles
  if (!user || profiles.length === 0) {
    return null;
  }

  // Don't render if no profiles for current perspective
  if (filteredProfiles.length === 0) {
    return null;
  }

  // If only one profile for this role, don't show switcher
  if (filteredProfiles.length === 1) {
    return null;
  }

  // Compact button-based version for mobile menu
  if (compact) {
    return (
      <div className="space-y-2 py-3 border-b border-wine/10">
        <Label className="text-xs font-serif font-semibold text-ink/80 uppercase tracking-wide">
          Select {getRoleLabel(currentPerspective as any)} Profile
        </Label>
        <div className="flex flex-col gap-2">
          {filteredProfiles.map((profile) => (
            <Button
              key={profile.id}
              variant={selectedProfileId === profile.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleProfileSelect(profile.id)}
              className={cn(
                'w-full justify-start font-serif text-sm text-left',
                selectedProfileId === profile.id
                  ? 'bg-wine text-parchment hover:bg-wine/90'
                  : 'border-wine text-ink hover:bg-wine/10'
              )}
            >
              <span className="truncate">{profile.name}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Full version for other contexts
  return (
    <div className="space-y-2 py-3 border-b border-wine/10">
      <Label className="text-sm font-serif font-semibold text-ink/80 uppercase tracking-wide">
        Select {getRoleLabel(currentPerspective as any)} Profile
      </Label>
      <div className="flex flex-col gap-2">
        {filteredProfiles.map((profile) => (
          <Button
            key={profile.id}
            variant={selectedProfileId === profile.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleProfileSelect(profile.id)}
            className={cn(
              'w-full justify-start font-serif text-sm',
              selectedProfileId === profile.id
                ? 'bg-wine text-parchment hover:bg-wine/90'
                : 'border-wine text-ink hover:bg-wine/10'
            )}
          >
            {profile.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Get the currently selected profile ID from localStorage
 */
export function getSelectedProfileId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  return localStorage.getItem(SELECTED_PROFILE_KEY);
}

