'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useAuthChangeListener } from '@kit/supabase/hooks/use-auth-change-listener';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';

export function AuthProvider(props: React.PropsWithChildren) {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  useAuthChangeListener({
    appHomePath: pathsConfig.app.home,
    onEvent: (event: AuthChangeEvent, session: Session | null) => {
      // Skip query invalidation on auth pages to prevent redirect loops
      // The queries will be refetched naturally when navigating away from auth pages
      if (pathname?.startsWith('/auth')) {
        return;
      }

      // Only invalidate on final auth state changes (not intermediate events)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        queryClient.invalidateQueries({ queryKey: ['supabase:user'] });
        queryClient.invalidateQueries({ queryKey: ['account:data'] });
      }
    },
  });

  return props.children;
}

