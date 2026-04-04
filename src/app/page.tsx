import { redirect } from "next/navigation";
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getFeaturedEntry } from "./admin/_actions/get-featured-entry";
import { LandingPageContent } from "./page-content";

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
    <main className="min-h-screen flex flex-col items-center p-8 sm:p-20 font-landing overflow-x-hidden">
      {/* Masthead — first full screen */}
      <header className="min-h-screen min-h-viewport w-full max-w-4xl flex flex-col items-center justify-center text-center pb-10">
        <h1 className="text-6xl sm:text-8xl font-bold tracking-tight mb-4 text-wine">
          PROVENANCE
        </h1>
        <p className="text-xl sm:text-2xl font-light tracking-tight text-ink/80">
          PRESERVING CULTURAL HERITAGE
        </p>
      </header>

      {/* Sections 1–4: Featured, Certificates, Collection, Tools (with parallax + scroll animations) */}
      <LandingPageContent featuredEntry={featuredEntry ?? null} />

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center text-sm text-ink/60 font-landing py-8">
        <p>© {new Date().getFullYear()} Provence Platform. Patent Pending.</p>
      </footer>
    </main>
  );
}
