import { getFeaturedEntry } from "../admin/_actions/get-featured-entry";
import { V2LandingContent } from "./page-content";
import { ChevronDown } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function V2Landing() {
  const { featuredEntry } = await getFeaturedEntry();

  return (
    <main className="min-h-screen flex flex-col items-center overflow-x-hidden font-landing bg-parchment">
      {/* Masthead */}
      <header className="relative min-h-screen min-h-viewport w-full flex flex-col items-center justify-center text-center px-6">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-px bg-wine/40" />
          <h1 className="text-6xl sm:text-8xl lg:text-9xl font-bold tracking-[0.12em] text-wine">
            PROVENANCE
          </h1>
          <div className="w-16 h-px bg-wine/40" />
          <p className="text-lg sm:text-xl font-light tracking-[0.3em] text-ink/70 uppercase">
            Preserving Cultural Heritage
          </p>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-wine/50" strokeWidth={1.5} />
        </div>
      </header>

      <V2LandingContent featuredEntry={featuredEntry ?? null} />

      {/* Footer */}
      <footer className="w-full text-center text-sm text-ink/50 font-landing py-12 border-t border-wine/10">
        <p>&copy; {new Date().getFullYear()} Provenance Platform. Patent Pending.</p>
      </footer>
    </main>
  );
}
