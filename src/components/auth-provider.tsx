'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthChangeListener } from '@kit/supabase/hooks/use-auth-change-listener';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';

export function AuthProvider(props: React.PropsWithChildren) {
  const queryClient = useQueryClient();

  useAuthChangeListener({
    appHomePath: pathsConfig.app.home,
    onEvent: (event: AuthChangeEvent, session: Session | null) => {
      // Invalidate user query cache when auth state changes
      // This ensures the UI updates after OAuth login
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        queryClient.invalidateQueries({ queryKey: ['supabase:user'] });
        queryClient.invalidateQueries({ queryKey: ['account:data'] });
      }
    },
  });

  return props.children;
}

