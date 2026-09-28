'use client';

import { useState } from 'react';
import { Ban, Sparkles } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Switch } from '@kit/ui/switch';
import { Label } from '@kit/ui/label';
import { setAiConsent } from '~/app/_actions/ai-consent';
import { unblockUser } from '~/app/_actions/moderation';
import { useAiConsent } from '~/components/ai-consent/ai-consent-provider';
import { useLegalModal } from '~/components/legal/legal-modal-context';

type BlockedUser = { id: string; name: string; blockedAt: string };

/**
 * Lets the user give or withdraw consent to share their data with our
 * third-party AI provider (App Store guidelines 5.1.1(ii) and 5.1.2(i)).
 * Also lists blocked users with an unblock control (guideline 1.2).
 */
export function PrivacySection({
  aiConsented,
  blockedUsers: initialBlocked,
}: {
  aiConsented: boolean;
  blockedUsers: BlockedUser[];
}) {
  const [blockedUsers, setBlockedUsers] = useState(initialBlocked);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(aiConsented);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { resetAiConsentCache } = useAiConsent();
  const { openLegalDocument } = useLegalModal();

  async function handleChange(next: boolean) {
    setSaving(true);
    setError(null);
    const result = await setAiConsent(next);
    setSaving(false);
    if (!result.success) {
      setError('Could not save your choice. Please try again.');
      return;
    }
    setEnabled(next);
    resetAiConsentCache();
  }

  async function handleUnblock(id: string) {
    setUnblocking(id);
    const result = await unblockUser(id);
    setUnblocking(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <section id="privacy" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">Privacy</h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Control how your data is shared.{' '}
          <button
            type="button"
            className="text-wine underline hover:no-underline"
            onClick={() => openLegalDocument('privacy')}
          >
            Privacy Policy
          </button>
        </p>
      </div>

      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-wine/60" aria-hidden />
            <div>
              <CardTitle className="font-display text-wine">AI features</CardTitle>
              <CardDescription className="font-serif">
                Taco and the grant, opportunity, CV, checklist, press and valuation tools use AI from OpenAI.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <Label htmlFor="ai-consent" className="font-serif text-sm text-ink/80 leading-relaxed">
              Allow Provenance to send the information these features need (your messages, profile
              details, uploaded files, and artwork details) to OpenAI to generate responses. OpenAI
              does not use this data to train its models.
            </Label>
            <Switch
              id="ai-consent"
              checked={enabled}
              disabled={saving}
              onCheckedChange={handleChange}
            />
          </div>
          <p className="font-serif text-xs text-ink/55">
            {enabled
              ? 'AI features are on. Turning this off stops any further data being sent to OpenAI, including AI grant picks in your weekly digest.'
              : 'AI features are off. You will be asked before any AI feature runs.'}
          </p>
          {error && <p className="text-sm text-red-600 font-serif" role="alert">{error}</p>}
        </CardContent>
      </Card>

      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Ban className="h-5 w-5 text-wine/60" aria-hidden />
            <div>
              <CardTitle className="font-display text-wine">Blocked users</CardTitle>
              <CardDescription className="font-serif">
                You don’t see content from people you block. Block someone from the ⋯ menu on their profile or work.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {blockedUsers.length === 0 ? (
            <p className="font-serif text-sm text-ink/60">You haven’t blocked anyone.</p>
          ) : (
            <ul className="divide-y divide-ink/10">
              {blockedUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-4 py-2">
                  <span className="font-serif text-sm text-ink">{u.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-serif"
                    disabled={unblocking === u.id}
                    onClick={() => handleUnblock(u.id)}
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
