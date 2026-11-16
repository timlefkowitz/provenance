import Image from 'next/image';

/**
 * Wide banner across the top of a public profile page. Set per role profile
 * (artist, gallery, institution) from the profile's edit page.
 */
export function ProfileHeaderBanner({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) return null;
  return (
    <div className="relative w-full h-40 sm:h-56 md:h-72 bg-wine/5 overflow-hidden border-b border-wine/15">
      <Image src={url} alt={alt} fill priority sizes="100vw" className="object-cover" unoptimized />
    </div>
  );
}
