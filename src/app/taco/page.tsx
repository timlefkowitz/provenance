import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { TacoAssistant } from './_components/taco-assistant';

export const metadata = {
  title: 'Ask Taco | Provenance',
  description: 'Your studio AI — ask anything, share images and documents',
};

export default async function TacoPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-parchment flex flex-col">
      <TacoAssistant userId={user.id} />
    </div>
  );
}
