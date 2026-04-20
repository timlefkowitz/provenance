'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';
import { getPerspective } from '~/components/perspective-switcher';
import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';
import { NewExhibitionDialog } from './new-exhibition-dialog';

type OwnerMode = typeof USER_ROLES.GALLERY | typeof USER_ROLES.INSTITUTION;

const PERSPECTIVE_KEY = 'user_perspective';
const PERSPECTIVE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ALL_ROLES: UserRole[] = [
  USER_ROLES.ARTIST,
  USER_ROLES.COLLECTOR,
  USER_ROLES.GALLERY,
  USER_ROLES.INSTITUTION,
];

function perspectiveToOwner(role: UserRole | null): OwnerMode | null {
  if (role === USER_ROLES.GALLERY) return USER_ROLES.GALLERY;
  if (role === USER_ROLES.INSTITUTION) return USER_ROLES.INSTITUTION;
  return null;
}

function writePerspectiveCookie(value: UserRole) {
  if (typeof document === 'undefined') return;
  document.cookie = `${PERSPECTIVE_KEY}=${encodeURIComponent(value)}; path=/; max-age=${PERSPECTIVE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Client island for the Collection page header. Shows the active mode and
 * lets the user switch between Artist, Collector, Gallery, and Institution
 * directly in the header — no need to open the nav sidebar. Switching updates
 * the same localStorage key and cookie that the global PerspectiveSwitcher
 * uses so the rest of the app stays in sync.
 */
export function CollectionHeaderActions({
  accountRole,
}: {
  accountRole: UserRole | null;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [perspective, setPerspective] = useState<UserRole | null>(null);

  useEffect(() => {
    setMounted(true);
    setPerspective(getPerspective());

    const handler = (event: Event) => {
      const custom = event as CustomEvent<UserRole>;
      if (custom.detail) {
        setPerspective(custom.detail);
      }
    };
    window.addEventListener('user_perspective_changed', handler);
    return () => {
      window.removeEventListener('user_perspective_changed', handler);
    };
  }, []);

  const handleModeSwitch = (role: UserRole) => {
    console.log('[Collection] CollectionHeaderActions mode switch', { role });
    setPerspective(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PERSPECTIVE_KEY, role);
      writePerspectiveCookie(role);
      window.dispatchEvent(new CustomEvent('user_perspective_changed', { detail: role }));
    }
    router.refresh();
  };

  // Server renders using account role; once mounted we trust localStorage.
  const activeRole: UserRole | null = mounted ? perspective : accountRole;
  const ownerMode = perspectiveToOwner(activeRole);

  const disabledReason =
    ownerMode === null
      ? 'Switch to Gallery or Institution mode to create an exhibition.'
      : undefined;

  return (
    <div className="flex flex-col items-end gap-3">
      {/* Mode switcher — always visible */}
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-[10px] font-serif font-medium tracking-wider text-ink/40 uppercase">
          Active mode
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-wine/20 bg-parchment/60 p-0.5">
          {ALL_ROLES.map((role) => {
            const isActive = activeRole === role;
            return (
              <Button
                key={role}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleModeSwitch(role)}
                className={cn(
                  'h-7 px-2.5 text-xs font-serif rounded-md transition-all',
                  isActive
                    ? 'bg-wine text-parchment shadow-sm hover:bg-wine/90'
                    : 'text-ink/60 hover:text-ink hover:bg-wine/10',
                )}
                aria-pressed={isActive}
              >
                {getRoleLabel(role)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* New Exhibition — only meaningful in gallery/institution mode */}
      <NewExhibitionDialog
        ownerRole={ownerMode}
        disabled={ownerMode === null}
        disabledReason={disabledReason}
      />
    </div>
  );
}
