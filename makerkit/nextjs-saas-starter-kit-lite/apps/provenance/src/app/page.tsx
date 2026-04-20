import Link from "next/link";
import Image from "next/image";
import { getSupabaseServerClient } from "@kit/supabase/server-client";

import { GoogleSignInButton } from "~/components/google-sign-in-button";

interface FeaturedArtwork {
  id: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  image_url: string | null;
  featured_at: string | null;
}

async function getFeaturedArtwork(): Promise<FeaturedArtwork | null> {
  try {
    const client = getSupabaseServerClient();
    const { data } = await (client as any)
      .from("artworks")
      .select("id, title, artist_name, description, image_url, featured_at")
      .eq("featured", true)
      .order("featured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const featured = await getFeaturedArtwork();

  return (
    <main className="min-h-screen flex flex-col items-center p-8 sm:p-20 font-serif">
      {/* Masthead */}
      <header className="w-full max-w-4xl flex flex-col items-center mb-12 text-center border-b-4 border-double border-wine pb-8">
        <h1 className="font-display text-6xl sm:text-8xl tracking-widest mb-4 text-wine">
          PROVENANCE
        </h1>
        <div className="w-full h-px bg-wine mb-2 opacity-50" />
        <div className="w-full h-px bg-wine mb-4" />
        <p className="font-body italic text-xl sm:text-2xl">
          A Journal of Art, Objects &amp; Their Histories
        </p>
      </header>

      {/* Sign In CTA */}
      <div className="mb-12 flex flex-col items-center gap-4">
        <GoogleSignInButton />
      </div>

      {/* Navigation / Sections */}
      <nav className="w-full max-w-3xl mb-16">
        <ul className="flex flex-wrap justify-center gap-8 sm:gap-12 text-lg sm:text-xl uppercase tracking-wider font-display">
          <li>
            <Link
              href="/artworks"
              className="hover:text-wine hover:underline underline-offset-4 decoration-1"
            >
              Artworks
            </Link>
          </li>
          <li>
            <Link
              href="/collectibles"
              className="hover:text-wine hover:underline underline-offset-4 decoration-1"
            >
              Collectibles
            </Link>
          </li>
          <li>
            <Link
              href="/registry"
              className="hover:text-wine hover:underline underline-offset-4 decoration-1"
            >
              Registry
            </Link>
          </li>
          <li>
            <Link
              href="/articles"
              className="hover:text-wine hover:underline underline-offset-4 decoration-1"
            >
              Articles
            </Link>
          </li>
        </ul>
      </nav>

      {/* Featured Section */}
      {featured ? (
        <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center border-4 border-double border-wine p-8 md:p-12">
          <div className="flex flex-col gap-6">
            <span className="font-display text-sm tracking-widest text-wine uppercase">
              Featured Entry
            </span>
            <h2 className="font-display text-3xl md:text-4xl leading-tight">
              {featured.title}
            </h2>
            {featured.artist_name && (
              <p className="font-body text-base text-wine/70 -mt-4 italic">
                {featured.artist_name}
              </p>
            )}
            {featured.description && (
              <p className="font-body text-lg leading-relaxed opacity-90 line-clamp-4">
                {featured.description}
              </p>
            )}
            <Link
              href={`/artworks/${featured.id}`}
              className="self-start border-b border-wine pb-1 font-body italic hover:opacity-70"
            >
              View the full provenance record &rarr;
            </Link>
          </div>
          <div className="aspect-[4/5] bg-stone-200 border border-wine/20 overflow-hidden relative">
            {featured.image_url ? (
              <Image
                src={featured.image_url}
                alt={featured.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-stone-400 italic text-sm">
                No image
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center border-4 border-double border-wine/30 p-8 md:p-12">
          <div className="flex flex-col gap-6">
            <span className="font-display text-sm tracking-widest text-wine/50 uppercase">
              Featured Entry
            </span>
            <h2 className="font-display text-3xl md:text-4xl leading-tight text-ink/40 italic">
              Coming Soon
            </h2>
            <p className="font-body text-lg leading-relaxed text-ink/40">
              Our editors are reviewing exceptional works for this space. Check back soon.
            </p>
          </div>
          <div className="aspect-[4/5] bg-stone-100 flex items-center justify-center text-stone-300 italic border border-wine/10">
            —
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-20 w-full max-w-4xl text-center text-sm opacity-60 font-body">
        <p>© {new Date().getFullYear()} Provenance Platform.</p>
      </footer>
    </main>
  );
}
