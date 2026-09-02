'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Check, Gem, Palette } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Trans } from '@kit/ui/trans';

import { updateUserRole } from '../_actions/update-user-role';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';
import { SUBSCRIPTION_PRICES } from '~/lib/stripe-config';
import { gtmService } from '~/lib/gtm';

const ROLE_OPTIONS = [
  {
    value: USER_ROLES.ARTIST,
    label: 'Artist',
    description: 'Document and certify the authenticity of your own work.',
    icon: Palette,
  },
  {
    value: USER_ROLES.COLLECTOR,
    label: 'Collector',
    description: 'Track provenance and ownership for pieces you own.',
    icon: Gem,
  },
  {
    value: USER_ROLES.GALLERY,
    label: 'Gallery',
    description: 'Manage shows and certify work for artists you represent.',
    icon: Building2,
  },
] satisfies Array<{
  value: UserRole;
  label: string;
  description: string;
  icon: typeof Palette;
}>;

export function OnboardingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | ''>('');

  const handleContinue = () => {
    if (!role) {
      setError('Please select a role to continue.');
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await updateUserRole(role);
        gtmService.trackOnboardingComplete(role);
        router.refresh();
        // Artists go to the Taco onboarding interview to collect CV,
        // sales history, medium, and goals before the first-certificate aha moment.
        // Collectors and galleries go straight to the certificate flow.
        if (role === USER_ROLES.ARTIST) {
          router.push('/onboarding/chat');
        } else {
          router.push('/artworks/add?first_run=1');
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = role === option.value;
          const price = SUBSCRIPTION_PRICES[option.value];

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setError(null);
                setRole(option.value);
              }}
              aria-pressed={selected}
              className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                selected
                  ? 'border-[#4A2F25] bg-[#4A2F25]/5 ring-1 ring-[#4A2F25]'
                  : 'border-stone-200 hover:border-[#4A2F25]/40 hover:bg-stone-50'
              }`}
            >
              {selected && <Check className="absolute right-3 top-3 h-4 w-4 text-[#4A2F25]" />}
              <Icon className={`h-6 w-6 ${selected ? 'text-[#4A2F25]' : 'text-stone-500'}`} />
              <span className="font-display text-base font-semibold text-[#111111]">
                {option.label}
              </span>
              <span className="font-body text-xs text-stone-600">{option.description}</span>
              <span className="font-body text-xs font-medium text-[#4A2F25]">
                Free for 14 days, then ${price.monthly}/mo
              </span>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        className="w-full bg-[#4A2F25] text-[#F5F1E8] hover:bg-[#4A2F25]/90"
        disabled={pending || !role}
        onClick={handleContinue}
      >
        {pending ? (
          <Trans i18nKey="onboarding:saving" defaults="Saving..." />
        ) : (
          <>
            <Trans i18nKey="onboarding:continue" defaults="Continue" />
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
