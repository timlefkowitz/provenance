import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { TacoProfileChatbot } from '../../_components/taco-profile-chatbot';
import { isValidRole, getRoleLabel } from '~/lib/user-roles';

export const metadata = {
  title: 'Create Profile with Taco | Provenance',
};

/**
 * Pull a sensible "display name" out of whatever Supabase has on the
 * authenticated user — preferring an explicit full_name set by the OAuth
 * provider, falling back to first_name/last_name fragments.
 */
function pickDisplayName(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return undefined;
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    [meta.first_name, meta.last_name].filter(Boolean).join(' '),
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return undefined;
}

export default async function CreateProfileWithTacoPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const params = await searchParams;
  const role = params.role;

  if (!role || !isValidRole(role)) {
    redirect('/profiles');
  }

  const prefillName = pickDisplayName(user.user_metadata);
  const prefillEmail = user.email ?? undefined;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-wine mb-1">
            Set up your {getRoleLabel(role)} profile with Taco
          </h1>
          <p className="text-ink/70 font-serif">
            A short conversation instead of a long form. Paste in chunks, drop
            in a photo, or even talk to Taco — he&apos;ll sort the structured
            data for you.
          </p>
        </div>
        <Link
          href={`/profiles/new?role=${role}`}
          className="text-sm font-serif text-wine/80 underline underline-offset-4 hover:text-wine"
        >
          Use the classic form instead
        </Link>
      </div>

      <TacoProfileChatbot
        role={role}
        prefill={{ name: prefillName, contact_email: prefillEmail }}
      />
    </div>
  );
}
