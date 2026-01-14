import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getFeaturedEntry } from "./admin/_actions/get-featured-entry";

// Force dynamic rendering so featured artwork changes on each page load
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Check if user is authenticated and redirect to portal
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  
  if (user) {
    redirect('/portal');
  }

  // Get featured entry (read-only, safe)
  const { featuredEntry } = await getFeaturedEntry();
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
          A Journal of Art, Objects & Their Histories
        </p>
      </header>

      {/* Featured Section */}
      {featuredEntry ? (
        <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center border-4 border-double border-wine p-8 md:p-12">
          <div className="flex flex-col gap-6">
            <span className="font-display text-sm tracking-widest text-wine uppercase">
              Featured Entry
            </span>
            <h2 className="font-display text-3xl md:text-4xl leading-tight">
              {featuredEntry.title}
            </h2>
            <p className="font-body text-lg leading-relaxed opacity-90">
              {featuredEntry.description}
            </p>
            {featuredEntry.link_url && (
              <Link 
                href={featuredEntry.link_url} 
                className="self-start border-b border-wine pb-1 font-body italic hover:opacity-70"
              >
                Read the full registry &rarr;
              </Link>
            )}
          </div>
          <div className="aspect-[4/5] bg-stone-200 flex items-center justify-center text-stone-400 italic border border-wine/20 overflow-hidden relative">
            {featuredEntry.image_url ? (
              <Image
                src={featuredEntry.image_url}
                alt={featuredEntry.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <span>[Image Placeholder]</span>
            )}
          </div>
        </section>
      ) : (
        <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center border-4 border-double border-wine p-8 md:p-12">
          <div className="flex flex-col gap-6">
            <span className="font-display text-sm tracking-widest text-wine uppercase">
              Featured Entry
            </span>
            <h2 className="font-display text-3xl md:text-4xl leading-tight">
              The Recovered Vermeer: A Timeline of Ownership
            </h2>
            <p className="font-body text-lg leading-relaxed opacity-90">
              Tracing the provenance of the recently authenticated masterpiece through three centuries of documented transfers, now immutable on the Avalanche C-Chain.
            </p>
            <Link href="/articles/recovered-vermeer" className="self-start border-b border-wine pb-1 font-body italic hover:opacity-70">
              Read the full registry &rarr;
            </Link>
          </div>
          <div className="aspect-[4/5] bg-stone-200 flex items-center justify-center text-stone-400 italic border border-wine/20">
            [Image Placeholder: Vermeer Painting]
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-20 w-full max-w-4xl text-center text-sm opacity-60 font-body">
        <p>© {new Date().getFullYear()} Provence Platform. Verified on Avalanche.</p>
      </footer>
    </main>
  );
}
