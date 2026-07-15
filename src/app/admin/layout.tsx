import { requireAdmin } from '~/lib/admin';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminMfaSetupBanner } from './_components/admin-mfa-setup-banner';
import { adminMainClass, adminShellBg } from './_components/admin-dash-tokens';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Enforce authentication, admin status, and MFA assurance at the layout level.
  // Pages that also call requireAdmin() will benefit from the cached Supabase session.
  const { requiresMfaSetup, mfaGraceDeadline } = await requireAdmin();

  return (
    <div className={`flex min-h-screen flex-col md:flex-row ${adminShellBg}`}>
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        {requiresMfaSetup && <AdminMfaSetupBanner graceDeadline={mfaGraceDeadline} />}
        <main className={adminMainClass}>{children}</main>
      </div>
    </div>
  );
}
