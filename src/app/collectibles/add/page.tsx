import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { AddCollectibleForm } from './_components/add-collectible-form';

export const metadata = {
  title: 'Add Collectible | Provenance',
};

export default async function AddCollectiblePage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  console.log('[Collectibles] Add page loaded', { userId: user.id });

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase mb-2">
          <Link href="/collectibles" className="hover:text-wine transition-colors">
            Collectibles
          </Link>
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-wine tracking-tight">
          Add a Collectible
        </h1>
        <p className="mt-3 text-ink/70 font-serif leading-relaxed">
          Add a photo, tell us what kind of collectible it is, and add the details. Once posted,
          you&apos;ll receive a Certificate of Ownership with a QR code you can print and attach.
        </p>
      </div>

      <AddCollectibleForm userId={user.id} />
    </div>
  );
}
