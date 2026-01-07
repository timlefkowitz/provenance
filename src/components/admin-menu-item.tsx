'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@kit/supabase/hooks/use-user';
import { DropdownMenuItem } from '@kit/ui/dropdown-menu';
import { Shield } from 'lucide-react';

export function AdminMenuItem() {
  const user = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!user.data?.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/check');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin === true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAdmin();
  }, [user.data?.id]);

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <>
      <DropdownMenuItem asChild>
        <Link
          className={'flex cursor-pointer items-center space-x-2'}
          href="/admin"
        >
          <Shield className={'h-5'} />
          <span>Admin</span>
        </Link>
      </DropdownMenuItem>
    </>
  );
}

