'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';
import { getPerspective } from '~/components/perspective-switcher';

const PERSPECTIVE_KEY = 'user_perspective';

export function RoleModeSwitcher({
  onModeChange,
}: {
  onModeChange?: (mode: UserRole) => void;
}) {
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<UserRole>(USER_ROLES.ARTIST);

  // Load perspective from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = getPerspective();
      setCurrentMode(saved);
    }
  }, []);

  const handleModeChange = (mode: UserRole) => {
    setCurrentMode(mode);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(PERSPECTIVE_KEY, mode);
    }
    
    // Notify parent component
    if (onModeChange) {
      onModeChange(mode);
    }
    
    // Refresh to apply perspective changes
    router.refresh();
  };

  const modes = [
    { value: USER_ROLES.ARTIST, label: getRoleLabel(USER_ROLES.ARTIST) },
    { value: USER_ROLES.COLLECTOR, label: getRoleLabel(USER_ROLES.COLLECTOR) },
    { value: USER_ROLES.GALLERY, label: getRoleLabel(USER_ROLES.GALLERY) },
  ];

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm font-serif text-ink/70 mr-2">Mode:</span>
      <div className="flex gap-2">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => handleModeChange(mode.value)}
            className={`px-4 py-1.5 text-sm font-serif font-medium rounded-full border transition-all ${
              currentMode === mode.value
                ? 'bg-wine text-parchment border-wine shadow-sm'
                : 'bg-parchment/50 text-ink/70 border-wine/30 hover:bg-wine/10 hover:border-wine/50'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

