'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { getRoleLabel, type UserRole } from '~/lib/user-roles';
import { Plus } from 'lucide-react';

export function CreateProfileButton({ role }: { role: UserRole }) {
  const router = useRouter();
  const label = getRoleLabel(role);

  return (
    <div className="inline-flex items-stretch rounded-md border border-wine/30 overflow-hidden bg-parchment/40">
      {/* Primary: chat with Taco */}
      <button
        type="button"
        onClick={() => router.push(`/profiles/new/chat?role=${role}`)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-serif text-wine hover:bg-wine/10 transition-colors"
        aria-label={`Create ${label} profile with Taco`}
      >
        <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-wine/30 bg-wine/10">
          <Image
            src="/taco-cat.png"
            alt=""
            fill
            sizes="24px"
            className="object-cover object-top"
          />
        </span>
        <span>
          Create {label} with <span className="font-semibold">Taco</span>
        </span>
      </button>

      {/* Secondary: classic form */}
      <button
        type="button"
        onClick={() => router.push(`/profiles/new?role=${role}`)}
        className="flex items-center gap-1 border-l border-wine/20 px-3 py-2 text-xs font-serif text-wine/70 hover:bg-wine/10 transition-colors"
        aria-label={`Create ${label} profile with the classic form`}
        title="Use the classic form"
      >
        <Plus className="h-3 w-3" />
        Form
      </button>
    </div>
  );
}

/**
 * Plain "form-only" button retained for places that don't want the
 * conversational entry-point (e.g. inside the classic-form page itself).
 */
export function CreateProfileFormButton({ role }: { role: UserRole }) {
  const router = useRouter();
  return (
    <Button
      onClick={() => router.push(`/profiles/new?role=${role}`)}
      variant="outline"
      className="font-serif border-wine/30 hover:bg-wine/10"
    >
      <Plus className="h-4 w-4 mr-2" />
      Create {getRoleLabel(role)} Profile
    </Button>
  );
}
