import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { TacoProfileChatbot } from '../../_components/taco-profile-chatbot';
import { isValidRole, getRoleLabel } from '~/lib/user-roles';

export const metadata = {
  title: 'Create Profile with Taco | Provenance',
};

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-wine mb-1">
            Set up your {getRoleLabel(role)} profile with Taco
          </h1>
          <p className="text-ink/70 font-serif">
            A short conversation instead of a long form. You can paste in
            chunks — Taco will sort the structured data for you.
          </p>
        </div>
        <Link
          href={`/profiles/new?role=${role}`}
          className="text-sm font-serif text-wine/80 underline underline-offset-4 hover:text-wine"
        >
          Use the classic form instead
        </Link>
      </div>

      <TacoProfileChatbot role={role} />
    </div>
  );
}
