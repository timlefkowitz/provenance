'use client';

import { useEffect, useState } from 'react';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';
import { getPerspective } from '~/components/perspective-switcher';
import { NewExhibitionDialog } from './new-exhibition-dialog';

type OwnerMode = typeof USER_ROLES.GALLERY | typeof USER_ROLES.INSTITUTION;

function perspectiveToOwner(role: UserRole | null): OwnerMode | null {
  if (role === USER_ROLES.GALLERY) return USER_ROLES.GALLERY;
  if (role === USER_ROLES.INSTITUTION) return USER_ROLES.INSTITUTION;
  return null;
}

/**
 * Client island for the Collection page header. Owns the "New Exhibition"
 * button. The button is only enabled when the active perspective is Gallery
 * or Institution; otherwise it shows a helpful tooltip. The perspective is
 * read from localStorage on mount and kept in sync with the existing
 * `user_perspective_changed` event so mode switches feel instant.
 */
export function CollectionHeaderActions({
  accountRole,
}: {
  accountRole: UserRole | null;
}) {
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

  // Server renders a disabled placeholder; once mounted we can trust localStorage.
  const activeRole: UserRole | null = mounted ? perspective : accountRole;
  const ownerMode = perspectiveToOwner(activeRole);

  const disabledReason =
    ownerMode === null
      ? 'Switch to Gallery or Institution mode to create an exhibition.'
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NewExhibitionDialog
        ownerRole={ownerMode}
        disabled={ownerMode === null}
        disabledReason={disabledReason}
      />
    </div>
  );
}
