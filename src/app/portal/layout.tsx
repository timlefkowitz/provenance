import { SiteLegalFooter } from '~/components/legal/site-legal-footer';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <SiteLegalFooter />
    </div>
  );
}
