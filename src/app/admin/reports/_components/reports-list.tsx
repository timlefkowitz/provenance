'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@kit/ui/sonner';
import { Button } from '@kit/ui/button';
import { REPORT_REASONS } from '~/lib/moderation/report-types';
import {
  dismissReport,
  hideReportedContent,
  suspendReportedUser,
  type AdminContentReport,
} from '../_actions/admin-reports';

function targetHref(r: AdminContentReport): string | null {
  switch (r.target_type) {
    case 'artwork':
      return `/artworks/${r.target_id}/certificate`;
    case 'collectible':
      return `/collectibles/${r.target_id}/certificate`;
    case 'exhibition':
      return `/exhibitions/${r.target_id}`;
    case 'profile':
    case 'user':
      return `/artists/${r.target_id}`;
    case 'grant':
      return '/grants';
  }
}

function hoursOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

export function ReportsList({ reports }: { reports: AdminContentReport[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(label);
      router.refresh();
    });
  }

  if (reports.length === 0) {
    return <p className="font-serif text-ink/60">No reports here.</p>;
  }

  return (
    <ul className="space-y-4">
      {reports.map((r) => {
        const href = targetHref(r);
        const reasonLabel = REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason;
        const age = hoursOpen(r.created_at);
        const overdue = r.status === 'open' && age >= 24;
        return (
          <li
            key={`${r.source}-${r.id}`}
            id={r.id}
            className={`rounded-lg border p-4 font-serif ${overdue ? 'border-red-300 bg-red-50/40' : 'border-ink/15 bg-white/60'}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold text-wine">{r.target_type}</span>
                {' · '}
                <span className="text-ink">{r.source === 'grant' ? 'Grant report' : reasonLabel}</span>
                {r.target_owner_name && <span className="text-ink/60"> · owner: {r.target_owner_name}</span>}
              </p>
              <p className={`text-xs ${overdue ? 'text-red-700 font-semibold' : 'text-ink/50'}`}>
                {new Date(r.created_at).toLocaleString()} · {age}h ago{overdue ? ' — overdue' : ''}
              </p>
            </div>
            {r.details && <p className="mt-2 text-sm text-ink/80 whitespace-pre-wrap">{r.details}</p>}
            <p className="mt-1 text-xs text-ink/50">
              Reported by {r.reporter_name ?? r.reporter_id}
              {r.resolution ? ` · ${r.status}: ${r.resolution}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {href && (
                <Button asChild size="sm" variant="outline">
                  <Link href={href} target="_blank">
                    View
                  </Link>
                </Button>
              )}
              {r.status === 'open' && (
                <>
                  <Button
                    size="sm"
                    disabled={pending}
                    className="bg-wine text-parchment hover:bg-wine/90"
                    onClick={() => run('Content hidden', () => hideReportedContent(r))}
                  >
                    Hide content
                  </Button>
                  {r.target_owner_id && (
                    <Button
                      size="sm"
                      disabled={pending}
                      className="bg-red-700 text-white hover:bg-red-800"
                      onClick={() => {
                        if (!confirm('Suspend this user and hide all of their content?')) return;
                        run('User suspended', () => suspendReportedUser(r.id, r.target_owner_id!));
                      }}
                    >
                      Suspend user
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run('Report dismissed', () => dismissReport(r.id, r.source))}
                  >
                    Dismiss
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
