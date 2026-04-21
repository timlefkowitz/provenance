import type { JwtPayload } from '@supabase/supabase-js';

import { Header } from '@kit/ui/marketing';

import { AppLogo } from '~/components/app-logo';
import { TacoNavbarPeekaboo } from '~/components/taco-navbar-peekaboo';

import { SiteHeaderAccountSection } from './site-header-account-section';
import { SiteNavigation } from './site-navigation';

export function SiteHeader(props: { user?: JwtPayload | null }) {
  return (
    <Header
      logo={
        <div className="relative">
          <AppLogo />
          <TacoNavbarPeekaboo />
        </div>
      }
      navigation={<SiteNavigation />}
      actions={<SiteHeaderAccountSection user={props.user ?? null} />}
    />
  );
}
