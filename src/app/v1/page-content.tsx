"use client";

import Link from "next/link";
import Image from "next/image";
import { FileCheck2, FolderOpen, Palette } from "lucide-react";
import { LandingSection } from "@/components/landing-section";

export type FeaturedEntryData = {
  artwork_id: string;
  title: string;
  description: string;
  link_url: string;
  image_url: string | null;
} | null;

type LandingPageContentProps = {
  featuredEntry: FeaturedEntryData;
};

export function LandingPageContent({ featuredEntry }: LandingPageContentProps) {
  return (
    <div className="font-landing">
      {/* Section 1: Featured Entry — full viewport */}
      <LandingSection id="featured" className="w-full max-w-5xl min-h-screen min-h-viewport flex flex-col justify-center">
        {featuredEntry ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <span className="text-xs font-medium tracking-[0.2em] text-wine/80 uppercase">
                Featured Entry
              </span>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-ink">
                {featuredEntry.title}
              </h2>
              <p className="text-lg font-normal leading-relaxed text-ink/90">
                {featuredEntry.description}
              </p>
              {featuredEntry.link_url && (
                <Link
                  href={featuredEntry.link_url}
                  className="self-start text-wine font-medium text-sm tracking-wide hover:opacity-70 transition-opacity"
                >
                  Read the full registry →
                </Link>
              )}
            </div>
            <div className="aspect-[4/5] bg-stone-200/80 rounded-2xl overflow-hidden relative shadow-sm">
              {featuredEntry.image_url ? (
                <Image
                  src={featuredEntry.image_url}
                  alt={featuredEntry.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-stone-400 italic">[Image Placeholder]</span>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <span className="text-xs font-medium tracking-[0.2em] text-wine/80 uppercase">
                Featured Entry
              </span>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-ink">
                The Recovered Vermeer: A Timeline of Ownership
              </h2>
              <p className="text-lg font-normal leading-relaxed text-ink/90">
                Tracing the provenance of the recently authenticated masterpiece
                through three centuries of documented transfers, now immutable on
                the Avalanche C-Chain.
              </p>
              <Link
                href="/articles/recovered-vermeer"
                className="self-start text-wine font-medium text-sm tracking-wide hover:opacity-70 transition-opacity"
              >
                Read the full registry →
              </Link>
            </div>
            <div className="aspect-[4/5] bg-stone-200/80 rounded-2xl flex items-center justify-center text-stone-400 italic">
              [Image Placeholder: Vermeer Painting]
            </div>
          </div>
        )}
      </LandingSection>

      {/* Section 2: Certificates of Authenticity — full viewport, video background */}
      <LandingSection
        id="certificates"
        className="w-screen max-w-none min-h-screen min-h-viewport overflow-hidden rounded-none -mx-8 sm:-mx-20 relative"
      >
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden
          >
            <source src="/videos/provenanceExample.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-ink/40 z-[1]" aria-hidden />
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 md:pb-12 text-center">
          <div className="flex justify-center mb-6">
            <span className="bg-parchment/70 p-3 rounded-lg inline-flex items-center justify-center">
              <FileCheck2 className="w-10 h-10 text-wine/90" strokeWidth={1.5} />
            </span>
          </div>
          <div className="bg-parchment/70 rounded-lg px-4 py-4 md:px-6 md:py-5 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-4">
              Certificates of Authenticities
            </h2>
            <p className="text-lg md:text-xl font-normal leading-relaxed text-ink/80">
              Certificates that travel with the physical artwork.
            </p>
            <ul className="mt-6 text-center text-base md:text-lg text-ink/90 space-y-2 list-none">
              <li>Certificate of Authenticity for the Artist</li>
              <li>Certificate of ownership for Collectors</li>
              <li>Certificate of show for Galleries</li>
            </ul>
          </div>
        </div>
      </LandingSection>

      {/* Section 3: Collection management — full viewport, video background */}
      <LandingSection
        id="collection"
        className="w-screen max-w-none min-h-screen min-h-viewport overflow-hidden rounded-none -mx-8 sm:-mx-20 relative"
      >
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden
          >
            <source src="/videos/landing-3mb.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-ink/40 z-[1]" aria-hidden />
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 md:pb-12 text-center">
          <div className="flex justify-center mb-6">
            <span className="bg-parchment/70 p-3 rounded-lg inline-flex items-center justify-center">
              <FolderOpen className="w-10 h-10 text-wine/90" strokeWidth={1.5} />
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-4">
            <span className="bg-parchment/70 px-4 py-1.5 md:px-6 md:py-2 box-decoration-clone rounded-lg">
              Collection Management
            </span>
          </h2>
          <div className="bg-parchment/70 rounded-lg px-4 py-4 md:px-6 md:py-5 max-w-2xl mx-auto text-center">
            <p className="text-lg md:text-xl font-normal leading-relaxed text-ink/80">
              Organize, verify, and share your collection with a single source of
              truth for each work.
            </p>
            <ul className="mt-6 text-center text-base md:text-lg text-ink/90 space-y-2 list-none">
              <li>Accessioning &amp; Cataloging</li>
              <li>Provenance &amp; Ownership Tracking</li>
              <li>Location &amp; Movement Control</li>
            </ul>
          </div>
        </div>
      </LandingSection>

      {/* Section 4: Professional artist tools — full viewport */}
      <LandingSection id="tools" className="w-full max-w-5xl min-h-screen min-h-viewport flex flex-col justify-center">
        <div className="py-12 md:py-16 text-center">
          <div className="flex justify-center mb-6">
            <Palette className="w-10 h-10 text-wine/90" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-4">
            Professional Artist Tools
          </h2>
          <p className="text-lg md:text-xl font-normal leading-relaxed text-ink/80 max-w-2xl mx-auto">
            Create certificates, manage your catalog, and keep provenance
            attached to your work for life.
          </p>
        </div>
      </LandingSection>
    </div>
  );
}
