'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '~/hooks/use-current-user';
import { Shield } from 'lucide-react';
import { cn } from '@kit/ui/utils';

const rowClass =
  'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-pointer items-center rounded-xs px-2 py-1.5 text-sm outline-none transition-colors select-none hover:bg-accent hover:text-accent-foreground';

export function AdminMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const userId = user.data?.sub ?? (user.data as { id?: string } | undefined)?.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!userId) {
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
        console.error('[AdminMenuItem] Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    void checkAdmin();
  }, [userId]);

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <Link
      href="/admin"
      className={cn(rowClass, 'flex items-center space-x-2')}
      onClick={onNavigate}
    >
      <Shield className="h-5" />
      <span>Admin</span>
    </Link>
  );
}
