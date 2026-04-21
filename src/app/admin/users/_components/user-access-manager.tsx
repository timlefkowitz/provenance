'use client';

import { useState, useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { searchUserByEmailForAdmin } from '../_actions/search-user-for-admin';
import { grantFreeAccess } from '../_actions/grant-free-access';
import { revokeFreeAccess } from '../_actions/revoke-free-access';
import type { AdminUserSearchHit } from '../_actions/search-user-for-admin';

const ROLES = ['artist', 'collector', 'gallery', 'institution'] as const;

const DURATIONS: { label: string; days: number }[] = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '365 days', days: 365 },
  { label: 'Permanent (no end date)', days: 0 },
];

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isFreeGrantRow(stripeSubscriptionId: string | null) {
  return Boolean(stripeSubscriptionId?.startsWith('free_'));
}

export function UserAccessManager() {
  const [email, setEmail] = useState('');
  const [users, setUsers] = useState<AdminUserSearchHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [grantRoleByUser, setGrantRoleByUser] = useState<
    Record<string, string>
  >({});
  const [grantDurationByUser, setGrantDurationByUser] = useState<
    Record<string, string>
  >({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function defaultRoleForUser(hit: AdminUserSearchHit) {
    const active = hit.subscriptions.find(
      (s) => s.status === 'active' || s.status === 'trialing',
    );
    if (active?.role && ROLES.includes(active.role as (typeof ROLES)[number])) {
      return active.role;
    }
    return 'artist';
  }

  function handleSearch() {
    setSearchError(null);
    setActionMessage(null);
    setActionError(null);
    startTransition(async () => {
      const res = await searchUserByEmailForAdmin(email);
      if (!res.ok) {
        setSearchError(res.error);
        setUsers(null);
        return;
      }
      setUsers(res.users);
      const nextRoles: Record<string, string> = {};
      const nextDur: Record<string, string> = {};
      for (const u of res.users) {
        nextRoles[u.id] = defaultRoleForUser(u);
        nextDur[u.id] = '365';
      }
      setGrantRoleByUser((prev) => ({ ...nextRoles, ...prev }));
      setGrantDurationByUser((prev) => ({ ...nextDur, ...prev }));
    });
  }

  async function handleGrant(userId: string) {
    setActionMessage(null);
    setActionError(null);
    const role = grantRoleByUser[userId] ?? 'artist';
    const durStr = grantDurationByUser[userId] ?? '365';
    const durationDays = Number.parseInt(durStr, 10);
    const res = await grantFreeAccess({ userId, role, durationDays });
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setActionMessage('Free access granted.');
    const search = await searchUserByEmailForAdmin(email);
    if (search.ok) {
      setUsers(search.users);
    }
  }

  async function handleRevoke(subscriptionId: string) {
    setActionMessage(null);
    setActionError(null);
    const res = await revokeFreeAccess(subscriptionId);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setActionMessage('Grant revoked.');
    const search = await searchUserByEmailForAdmin(email);
    if (search.ok) {
      setUsers(search.users);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-wine/20">
        <CardHeader>
          <CardTitle className="font-display text-wine">
            Find user by email
          </CardTitle>
          <CardDescription className="font-serif">
            Partial match is supported (e.g. domain or local part).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="admin-user-email" className="font-serif">
              Email
            </Label>
            <Input
              id="admin-user-email"
              type="search"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="user@example.com"
              className="font-serif"
            />
          </div>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={isPending || !email.trim()}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            {isPending ? 'Searching…' : 'Search'}
          </Button>
        </CardContent>
      </Card>

      {searchError && (
        <p className="text-sm text-red-600 font-serif">{searchError}</p>
      )}
      {actionError && (
        <p className="text-sm text-red-600 font-serif">{actionError}</p>
      )}
      {actionMessage && (
        <p className="text-sm text-green-700 font-serif">{actionMessage}</p>
      )}

      {users && users.length === 0 && (
        <p className="font-serif text-ink/70">No accounts matched.</p>
      )}

      {users?.map((hit) => (
        <Card key={hit.id} className="border-wine/15 bg-parchment/40">
          <CardHeader>
            <CardTitle className="font-display text-lg text-wine">
              {hit.name || '—'}
            </CardTitle>
            <CardDescription className="font-serif space-y-1">
              <span className="block">{hit.email}</span>
              <span className="block text-xs text-ink/50 font-mono">
                {hit.id}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-display text-sm font-semibold text-wine mb-2">
                Subscription rows
              </h3>
              {hit.subscriptions.length === 0 ? (
                <p className="text-sm font-serif text-ink/70">None yet.</p>
              ) : (
                <ul className="space-y-2 text-sm font-serif">
                  {hit.subscriptions.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-ink/15 bg-parchment/60 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-medium">{s.status}</span>
                          <span className="text-ink/60"> · {s.role}</span>
                          {isFreeGrantRow(s.stripe_subscription_id) && (
                            <span className="text-xs text-ink/50 block mt-1">
                              Admin grant:{' '}
                              {s.stripe_subscription_id?.slice(0, 24)}…
                            </span>
                          )}
                        </div>
                        {isFreeGrantRow(s.stripe_subscription_id) &&
                          s.status !== 'canceled' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="font-serif shrink-0"
                              onClick={() => handleRevoke(s.id)}
                            >
                              Revoke grant
                            </Button>
                          )}
                      </div>
                      <p className="text-xs text-ink/60 mt-2">
                        Period end: {formatWhen(s.current_period_end)} · Trial
                        end: {formatWhen(s.trial_end)} · Updated:{' '}
                        {formatWhen(s.updated_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-wine/20 p-4 space-y-4">
              <h3 className="font-display text-sm font-semibold text-wine">
                Grant free access
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-serif">Role</Label>
                  <Select
                    value={grantRoleByUser[hit.id] ?? 'artist'}
                    onValueChange={(v) =>
                      setGrantRoleByUser((prev) => ({ ...prev, [hit.id]: v }))
                    }
                  >
                    <SelectTrigger className="font-serif">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-serif">Duration</Label>
                  <Select
                    value={grantDurationByUser[hit.id] ?? '365'}
                    onValueChange={(v) =>
                      setGrantDurationByUser((prev) => ({
                        ...prev,
                        [hit.id]: v,
                      }))
                    }
                  >
                    <SelectTrigger className="font-serif">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.days} value={String(d.days)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
                onClick={() => handleGrant(hit.id)}
              >
                Grant free access
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
