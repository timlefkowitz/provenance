import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Archive, ArrowLeft } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { asUntyped } from '~/lib/supabase-untyped';
import { getCertificateTypeLabel, CERTIFICATE_TYPES, USER_ROLES } from '~/lib/user-roles';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { RestoreCertificateButton } from '~/app/artworks/[id]/certificate/_components/void-certificate-controls';

export const metadata = {
  title: 'Archive | Provenance',
};

export const dynamic = 'force-dynamic';

type ArchivedCertificate = {
  id: string;
  title: string | null;
  artist_name: string | null;
  image_url: string | null;
  certificate_number: string | number | null;
  certificate_type: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

const ARCHIVE_SELECT =
  'id, title, artist_name, image_url, certificate_number, certificate_type, voided_at, void_reason';

/** Voided certificates the user holds, personally or through a gallery team. */
export default async function ArchivePage() {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/auth/sign-in');

  const galleryProfiles = await getUserGalleryProfiles(user.id, [USER_ROLES.GALLERY, USER_ROLES.INSTITUTION]);
  const galleryProfileIds = galleryProfiles.map((p) => p.id);

  // RLS (artworks_read_own) scopes this to the user's own and team rows.
  let query = client.from('artworks').select(ARCHIVE_SELECT).eq('status', 'voided');
  query =
    galleryProfileIds.length > 0
      ? query.or(`account_id.eq.${user.id},gallery_profile_id.in.(${galleryProfileIds.join(',')})`)
      : query.eq('account_id', user.id);

  const { data, error } = await query.order('voided_at', { ascending: false, nullsFirst: false });
  if (error) console.error('[Archive] voided certificates fetch failed', error);
  const certificates = (data ?? []) as ArchivedCertificate[];

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment">
      <div className="border-b border-wine/15 bg-gradient-to-b from-wine/[0.06] to-transparent">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
          <Link
            href="/artworks/my"
            className="inline-flex items-center gap-1.5 text-sm font-serif text-ink/60 hover:text-wine"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Collection
          </Link>
          <h1 className="mt-4 text-3xl sm:text-4xl font-display font-bold text-wine tracking-tight">
            Archive
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink/70 font-serif leading-relaxed">
            Certificates you have voided. They are hidden from your collection, the registry and public
            pages, and their QR codes show them as voided. Restore one to make it current again.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
        {certificates.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-wine/15 bg-white/70 p-8 sm:p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-wine/10 text-wine">
              <Archive className="h-6 w-6" strokeWidth={1.25} aria-hidden />
            </div>
            <p className="font-serif text-ink/70">
              No voided certificates. Use <strong>Void</strong> on a certificate to move it here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-wine/10 rounded-xl border border-wine/15 bg-white">
            {certificates.map((cert) => (
              <li key={cert.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                <Link
                  href={`/artworks/${cert.id}/certificate`}
                  className="flex min-w-0 flex-1 items-center gap-4 group"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-parchment grayscale">
                    {cert.image_url ? (
                      <Image
                        src={cert.image_url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-wine group-hover:underline">
                      {cert.title || 'Untitled'}
                    </p>
                    <p className="truncate font-serif text-sm text-ink/60">
                      {[
                        cert.artist_name,
                        getCertificateTypeLabel(cert.certificate_type || CERTIFICATE_TYPES.AUTHENTICITY),
                        cert.certificate_number ? `No. ${cert.certificate_number}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="font-serif text-xs text-red-800/80">
                      Voided
                      {cert.voided_at
                        ? ` ${new Date(cert.voided_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}`
                        : ''}
                      {cert.void_reason ? ` — ${cert.void_reason}` : ''}
                    </p>
                  </div>
                </Link>
                <RestoreCertificateButton artworkId={cert.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
