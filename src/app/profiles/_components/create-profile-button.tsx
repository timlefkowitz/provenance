'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { getRoleLabel } from '~/lib/user-roles';
import { type UserRole } from '~/lib/user-roles';
import { Plus } from 'lucide-react';

export function CreateProfileButton({ role }: { role: UserRole }) {
  const router = useRouter();

  const handleCreate = () => {
    router.push(`/profiles/new?role=${role}`);
  };

  return (
    <Button
      onClick={handleCreate}
      variant="outline"
      className="font-serif border-wine/30 hover:bg-wine/10"
    >
      <Plus className="h-4 w-4 mr-2" />
      Create {getRoleLabel(role)} Profile
    </Button>
  );
}

