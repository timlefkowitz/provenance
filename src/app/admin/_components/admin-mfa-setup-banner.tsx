import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

/**
 * Banner displayed at the top of the admin shell when the signed-in admin has
 * no MFA factors enrolled yet.
 *
 * Security context:
 * - Admins with enrolled factors who haven't step-up verified this session are
 *   redirected to /auth/verify by requireAdmin().
 * - Admins with NO factors enrolled are allowed through (to avoid locking out
 *   the only admin) but see this persistent reminder until they enroll.
 */
export function AdminMfaSetupBanner() {
  return (
    <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-800">
      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
      <span>
        <strong>Security notice:</strong> Your admin account does not have two-factor
        authentication enabled. Enable MFA to protect admin access.{' '}
        <Link
          href="/settings#security"
          className="underline underline-offset-2 font-medium hover:text-amber-900"
        >
          Set up MFA in Settings →
        </Link>
      </span>
    </div>
  );
}
