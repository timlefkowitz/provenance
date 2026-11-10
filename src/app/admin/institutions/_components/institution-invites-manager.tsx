'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import {
  DEFAULT_INSTITUTION_TRIAL_DAYS,
  formatTrialLength,
  INSTITUTION_TRIAL_DAY_OPTIONS,
  MAX_INVITES_PER_SEND,
  parseInviteEmails,
  type InstitutionTeamRole,
} from '~/lib/institutions/institution-invites';

import {
  resendInstitutionInvite,
  revokeInstitutionInvite,
  sendInstitutionInvites,
  type AdminInstitutionInvite,
  type InstitutionOption,
  type SendInviteOutcome,
} from '../_actions/institution-invites';

const NEW_INSTITUTION = '__new__';

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

const STATUS_STYLES: Record<AdminInstitutionInvite['status'], string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  accepted: 'border-green-300 bg-green-50 text-green-900',
  revoked: 'border-ink/20 bg-ink/5 text-ink/60',
};

export function InstitutionInvitesManager({
  institutions,
  invites,
  loadError,
}: {
  institutions: InstitutionOption[];
  invites: AdminInstitutionInvite[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [institutionId, setInstitutionId] = useState<string>(
    institutions[0]?.id ?? NEW_INSTITUTION,
  );
  const [newName, setNewName] = useState('');
  const [emails, setEmails] = useState('');
  const [teamRole, setTeamRole] = useState<InstitutionTeamRole>('member');
  const [trialDays, setTrialDays] = useState(String(DEFAULT_INSTITUTION_TRIAL_DAYS));
  const [note, setNote] = useState('');

  const [formError, setFormError] = useState<string | null>(loadError);
  const [outcomes, setOutcomes] = useState<SendInviteOutcome[] | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [rowMessage, setRowMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const parsed = useMemo(() => parseInviteEmails(emails), [emails]);
  const isNew = institutionId === NEW_INSTITUTION;
  const selected = institutions.find((i) => i.id === institutionId);

  const canSend =
    !isPending &&
    parsed.valid.length > 0 &&
    parsed.valid.length <= MAX_INVITES_PER_SEND &&
    (!isNew || newName.trim().length > 0);

  function handleSend() {
    setFormError(null);
    setOutcomes(null);
    setInvalid([]);
    startTransition(async () => {
      const res = await sendInstitutionInvites({
        institutionProfileId: isNew ? null : institutionId,
        newInstitutionName: isNew ? newName : undefined,
        emails,
        teamRole,
        trialDays: Number.parseInt(trialDays, 10),
        note,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setOutcomes(res.outcomes);
      setInvalid(res.invalid);
      setEmails('');
      if (isNew) {
        setInstitutionId(res.institutionProfileId);
        setNewName('');
      }
      router.refresh();
    });
  }

  function handleRowAction(action: 'resend' | 'revoke', invite: AdminInstitutionInvite) {
    setRowMessage(null);
    startTransition(async () => {
      const res =
        action === 'resend'
          ? await resendInstitutionInvite(invite.id)
          : await revokeInstitutionInvite(invite.id);
      setRowMessage(
        res.ok
          ? action === 'resend'
            ? `Sent again to ${invite.email}.`
            : `Cancelled the invite to ${invite.email}.`
          : res.error,
      );
      router.refresh();
    });
  }

  const visibleInvites =
    filter === 'all' ? invites : invites.filter((i) => i.institutionProfileId === filter);
  const invitedInstitutions = Array.from(
    new Map(invites.map((i) => [i.institutionProfileId, i.institutionName])).entries(),
  );

  return (
    <div className="space-y-6">
      <Card className="border-wine/20">
        <CardHeader>
          <CardTitle className="font-display text-wine">Invite a team</CardTitle>
          <CardDescription className="font-serif">
            Paste the team&apos;s emails, separated by commas or new lines. Each person gets their
            own link. The first person to accept for a new institution becomes its owner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-serif">Institution</Label>
              <Select value={institutionId} onValueChange={setInstitutionId}>
                <SelectTrigger className="font-serif">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_INSTITUTION}>+ New institution…</SelectItem>
                  {institutions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="font-serif text-xs text-ink/60">
                  {selected.hasOwner ? 'Has an owner' : 'No owner yet'} · {selected.teamSize} on
                  team
                </p>
              )}
            </div>
            {isNew && (
              <div className="space-y-2">
                <Label htmlFor="institution-name" className="font-serif">
                  Institution name
                </Label>
                <Input
                  id="institution-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Whitney Museum of American Art"
                  className="font-serif"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-emails" className="font-serif">
              Team emails
            </Label>
            <Textarea
              id="invite-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={5}
              placeholder={'registrar@museum.org\ncurator@museum.org, director@museum.org'}
              className="font-mono text-sm"
            />
            <p className="font-serif text-xs text-ink/60">
              {parsed.valid.length} {parsed.valid.length === 1 ? 'person' : 'people'}
              {parsed.valid.length > MAX_INVITES_PER_SEND &&
                ` — send at most ${MAX_INVITES_PER_SEND} at a time`}
              {parsed.invalid.length > 0 && (
                <span className="text-red-600">
                  {' '}
                  · can&apos;t read: {parsed.invalid.join(', ')}
                </span>
              )}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-serif">Team role</Label>
              <Select value={teamRole} onValueChange={(v) => setTeamRole(v as InstitutionTeamRole)}>
                <SelectTrigger className="font-serif">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member — works on the collection</SelectItem>
                  <SelectItem value="admin">Admin — can also manage the team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-serif">Free trial</Label>
              <Select value={trialDays} onValueChange={setTrialDays}>
                <SelectTrigger className="font-serif">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTITUTION_TRIAL_DAY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {formatTrialLength(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-note" className="font-serif">
              Personal note (optional)
            </Label>
            <Textarea
              id="invite-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Great meeting you at the registrars' conference…"
              className="font-serif"
            />
          </div>

          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="w-full bg-wine font-serif text-parchment hover:bg-wine/90 sm:w-auto"
          >
            {isPending
              ? 'Sending…'
              : `Send ${parsed.valid.length || ''} invite${parsed.valid.length === 1 ? '' : 's'}`}
          </Button>

          {formError && <p className="font-serif text-sm text-red-600">{formError}</p>}

          {outcomes && (
            <ul className="space-y-1 rounded-lg border border-wine/15 bg-parchment/40 p-3 font-serif text-sm">
              {outcomes.map((o) => (
                <li key={o.email} className="flex flex-wrap justify-between gap-2">
                  <span className="break-all">{o.email}</span>
                  <span
                    className={
                      o.result === 'sent'
                        ? 'text-green-700'
                        : o.result === 'failed'
                          ? 'text-red-600'
                          : 'text-ink/60'
                    }
                  >
                    {o.result === 'sent'
                      ? 'Sent'
                      : o.result === 'already_invited'
                        ? 'Already invited'
                        : `Failed: ${o.error}`}
                  </span>
                </li>
              ))}
              {invalid.map((entry) => (
                <li key={entry} className="flex justify-between gap-2">
                  <span className="break-all">{entry}</span>
                  <span className="text-red-600">Not an email</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-wine/20">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="font-display text-wine">Sent invites</CardTitle>
            <CardDescription className="font-serif">
              {invites.filter((i) => i.status === 'accepted').length} accepted ·{' '}
              {invites.filter((i) => i.status === 'pending').length} waiting
            </CardDescription>
          </div>
          {invitedInstitutions.length > 1 && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="font-serif sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All institutions</SelectItem>
                {invitedInstitutions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {rowMessage && <p className="font-serif text-sm text-ink/80">{rowMessage}</p>}
          {visibleInvites.length === 0 ? (
            <p className="font-serif text-sm text-ink/70">No invites yet.</p>
          ) : (
            <ul className="divide-y divide-wine/10">
              {visibleInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 font-serif">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-medium text-ink">{invite.email}</span>
                      <Badge variant="outline" className={STATUS_STYLES[invite.status]}>
                        {invite.status === 'pending' ? 'Waiting' : invite.status === 'accepted' ? 'Accepted' : 'Cancelled'}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink/60">
                      {invite.institutionName} · {invite.teamRole} ·{' '}
                      {formatTrialLength(invite.trialDays)} trial ·{' '}
                      {invite.status === 'accepted'
                        ? `accepted ${formatWhen(invite.acceptedAt)}`
                        : `sent ${formatWhen(invite.sentAt)}${invite.sendCount > 1 ? ` (${invite.sendCount}×)` : ''}`}
                    </p>
                    {invite.lastSendError && invite.status === 'pending' && (
                      <p className="text-xs text-red-600">Last send failed: {invite.lastSendError}</p>
                    )}
                  </div>
                  {invite.status === 'pending' && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="font-serif"
                        disabled={isPending}
                        onClick={() => handleRowAction('resend', invite)}
                      >
                        Resend
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="font-serif text-ink/70"
                        disabled={isPending}
                        onClick={() => handleRowAction('revoke', invite)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
