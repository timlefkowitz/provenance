import { AdminSidebar } from './_components/admin-sidebar';
import { adminMainClass, adminShellBg } from './_components/admin-dash-tokens';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flex min-h-screen flex-col md:flex-row ${adminShellBg}`}>
      <AdminSidebar />
      <main className={adminMainClass}>{children}</main>
    </div>
  );
}
