import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { daysUntil } from '~/lib/admin';

/**
 * Banner displayed at the top of the admin shell when the signed-in admin has
 * no MFA factors enrolled yet.
 *
 * Security context:
 * - Admins with enrolled factors who haven't step-up verified this session are
 *   redirected to /auth/verify by requireAdmin().
 * - Admins with NO factors enrolled are allowed through for a 7-day grace
 *   period (admin_mfa_grace_deadline) to avoid locking out the only admin,
 *   but see this reminder — with a shrinking countdown — until they enroll.
 *   Once the grace period expires, requireAdmin() hard-blocks and redirects
 *   to Settings instead of rendering this banner (CASA 3.3).
 */
export function AdminMfaSetupBanner({ graceDeadline }: { graceDeadline?: Date | null }) {
  const daysLeft = daysUntil(graceDeadline);

  const urgent = daysLeft !== null && daysLeft <= 2;

  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm ${
        urgent ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
    >
      <ShieldAlert className={`h-4 w-4 shrink-0 ${urgent ? 'text-red-500' : 'text-amber-500'}`} aria-hidden />
      <span>
        <strong>Security notice:</strong> Your admin account does not have two-factor
        authentication enabled.{' '}
        {daysLeft !== null
          ? daysLeft === 0
            ? 'You must enable MFA today to keep admin access.'
            : `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to enable MFA before admin access is blocked.`
          : 'Enable MFA to protect admin access.'}{' '}
        <Link
          href="/settings#security"
          className={`underline underline-offset-2 font-medium ${
            urgent ? 'hover:text-red-900' : 'hover:text-amber-900'
          }`}
        >
          Set up MFA in Settings →
        </Link>
      </span>
    </div>
  );
}
