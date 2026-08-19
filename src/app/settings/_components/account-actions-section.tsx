'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { AlertTriangle, Loader2, LogOut, Trash2 } from 'lucide-react';
import { deleteAccount } from '../_actions/delete-account';

export function AccountActionsSection() {
  const signOut = useSignOut();
  const router = useRouter();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut.mutateAsync();
    router.push('/');
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete my account') return;
    setDeleteError(null);
    setDeleting(true);
    console.log('[Settings] Account deletion confirmed by user');

    try {
      const result = await deleteAccount();
      if (!result.success) {
        setDeleteError(result.error ?? 'Deletion failed. Please try again or contact support.');
        setDeleting(false);
        return;
      }
      // Success — sign out and redirect to home.
      await signOut.mutateAsync().catch(() => {/* session already gone */});
      router.push('/?account_deleted=1');
    } catch (err) {
      console.error('[Settings] handleDeleteAccount threw', err);
      setDeleteError('Something went wrong. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <section id="account-actions" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">
          Account Actions
        </h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Sign out or manage your account.
        </p>
      </div>

      {/* Sign Out */}
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-wine">Sign Out</CardTitle>
          <CardDescription className="font-serif">
            Sign out of your Provenance account on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="font-serif border-wine/30 text-wine hover:bg-wine/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account — Danger Zone */}
      <Card className="border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden />
            <CardTitle className="font-display text-red-700 dark:text-red-400">
              Delete Account
            </CardTitle>
          </div>
          <CardDescription className="font-serif text-red-700/70 dark:text-red-400/70">
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="font-serif border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete My Account
            </Button>
          ) : (
            <div className="space-y-4 rounded-lg border border-red-200 bg-white p-4 dark:border-red-900 dark:bg-red-950/10">
              <div className="space-y-2">
                <p className="font-serif text-sm font-semibold text-red-700 dark:text-red-400">
                  This will permanently delete:
                </p>
                <ul className="font-serif text-sm text-red-700/80 dark:text-red-400/80 space-y-1 list-disc list-inside">
                  <li>Your account and all profile information</li>
                  <li>All artworks, certificates, and collection data</li>
                  <li>Your subscription (active billing must be cancelled separately in Stripe or Apple)</li>
                  <li>All exhibitions, operations records, and activity history</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="font-serif text-sm text-red-700 dark:text-red-400">
                  Type <strong>delete my account</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="delete my account"
                  disabled={deleting}
                  className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-serif text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-red-300 dark:border-red-800 dark:bg-red-950/20"
                />
              </div>

              {deleteError && (
                <p className="text-sm font-serif text-red-700 dark:text-red-400">
                  {deleteError}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                  className="font-serif"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteAccount}
                  disabled={
                    deleting ||
                    deleteConfirmText.trim().toLowerCase() !== 'delete my account'
                  }
                  className="font-serif bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Permanently Delete Account
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
