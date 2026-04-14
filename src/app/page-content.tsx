"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  FileCheck2,
  FolderOpen,
  Palette,
  ShieldCheck,
  UserCheck,
  Building2,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Receipt,
  FileSignature,
  Tag,
  BookOpen,
  Award,
  Megaphone,
} from "lucide-react";
import { LandingSection } from "@/components/landing-section";
import { LandingStatsSection } from "@/components/landing-stats-section";
import type { LandingPlatformStats } from "@/lib/landing-platform-stats.types";

export type FeaturedEntryData = {
  artwork_id: string;
  title: string;
  description: string;
  link_url: string;
  image_url: string | null;
} | null;

type V2LandingContentProps = {
  featuredEntry: FeaturedEntryData;
  platformStats: LandingPlatformStats;
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium tracking-[0.25em] text-wine/70 uppercase">
      {children}
    </span>
  );
}

function PatentBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase text-wine/80 border border-wine/25 rounded-full px-3 py-1">
      <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
      Patent Pending
    </span>
  );
}

export function V2LandingContent({ featuredEntry, platformStats }: V2LandingContentProps) {
  return (
    <div className="w-full font-landing">
      {/* ── Section 1: Featured Entry ── */}
      <LandingSection
        id="featured"
        className="w-full max-w-6xl mx-auto min-h-screen min-h-viewport flex flex-col justify-center px-6 sm:px-12"
      >
        {featuredEntry ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div className="flex flex-col gap-6">
              <SectionLabel>Featured Entry</SectionLabel>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.15] text-ink">
                {featuredEntry.title}
              </h2>
              <p className="text-lg font-normal leading-relaxed text-ink/80">
                {featuredEntry.description}
              </p>
              {featuredEntry.link_url && (
                <Link
                  href={featuredEntry.link_url}
                  className="group self-start inline-flex items-center gap-2 text-wine font-medium text-sm tracking-wide hover:gap-3 transition-all"
                >
                  Read the full registry
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
                </Link>
              )}
            </div>
            <div className="aspect-[4/5] bg-stone-200/60 rounded-2xl overflow-hidden relative shadow-lg ring-1 ring-wine/5">
              {featuredEntry.image_url ? (
                <Image
                  src={featuredEntry.image_url}
                  alt={featuredEntry.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-stone-400 italic">
                  [Image Placeholder]
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div className="flex flex-col gap-6">
              <SectionLabel>Featured Entry</SectionLabel>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.15] text-ink">
                The Recovered Vermeer: A Timeline of Ownership
              </h2>
              <p className="text-lg font-normal leading-relaxed text-ink/80">
                Tracing the provenance of the recently authenticated masterpiece
                through three centuries of documented transfers, now immutable on
                the Avalanche C-Chain.
              </p>
              <Link
                href="/articles/recovered-vermeer"
                className="group self-start inline-flex items-center gap-2 text-wine font-medium text-sm tracking-wide hover:gap-3 transition-all"
              >
                Read the full registry
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </Link>
            </div>
            <div className="aspect-[4/5] bg-stone-200/60 rounded-2xl flex items-center justify-center text-stone-400 italic shadow-lg ring-1 ring-wine/5">
              [Image Placeholder: Vermeer Painting]
            </div>
          </div>
        )}
      </LandingSection>

      {/* ── Section 2: Certificates of Authenticity ── */}
      <LandingSection
        id="certificates"
        className="w-full min-h-screen min-h-viewport flex flex-col justify-center bg-ink text-parchment"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-24 md:py-32">
          {/* Header */}
          <div className="text-center mb-16 md:mb-20">
            <div className="flex justify-center mb-6">
              <span className="bg-parchment/10 p-3.5 rounded-xl inline-flex items-center justify-center">
                <FileCheck2 className="w-8 h-8 text-parchment/80" strokeWidth={1.5} />
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-5">
              Certificates of Authenticity
            </h2>
            <p className="text-lg md:text-xl font-light leading-relaxed text-parchment/70 max-w-2xl mx-auto mb-6">
              Living documents that travel with the physical artwork &mdash;
              establishing provenance, ownership, and exhibition history.
            </p>
            <PatentBadge />
          </div>

          {/* Three certificate types */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-20 md:mb-24"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            {[
              {
                icon: UserCheck,
                title: "Certificate of Authenticity",
                audience: "For Artists",
                description:
                  "Establish authorship and create a permanent, verifiable record tied to your work. Every certificate carries a unique identifier that collectors and institutions can authenticate instantly.",
              },
              {
                icon: ShieldCheck,
                title: "Certificate of Ownership",
                audience: "For Collectors",
                description:
                  "Prove chain of ownership with an immutable digital record. When an artwork changes hands, ownership transfers seamlessly \u2014 preserving the full provenance history.",
              },
              {
                icon: Building2,
                title: "Certificate of Show",
                audience: "For Galleries",
                description:
                  "Document exhibition history with a certificate that records where a work has been shown. Build a verifiable exhibition record that adds value and context to every piece.",
              },
            ].map((cert, i) => (
              <motion.div
                key={cert.title}
                custom={i}
                variants={fadeUp}
                className="group rounded-2xl border border-parchment/10 bg-parchment/[0.04] p-8 md:p-10 hover:bg-parchment/[0.07] transition-colors"
              >
                <cert.icon className="w-7 h-7 text-parchment/60 mb-5" strokeWidth={1.5} />
                <p className="text-xs font-medium tracking-[0.2em] text-parchment/50 uppercase mb-2">
                  {cert.audience}
                </p>
                <h3 className="text-xl font-semibold tracking-tight mb-3 text-parchment/95">
                  {cert.title}
                </h3>
                <p className="text-sm leading-relaxed text-parchment/60">
                  {cert.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Updateable certificates flow */}
          <div className="border-t border-parchment/10 pt-16 md:pt-20">
            <div className="text-center mb-12">
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                Updateable Certificates
              </h3>
              <p className="text-base md:text-lg font-light text-parchment/60 max-w-xl mx-auto">
                Provenance is never static. Our certificates evolve with the artwork &mdash;
                every update requires the creator&apos;s explicit approval.
              </p>
            </div>
            <motion.div
              className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
            >
              {[
                {
                  icon: RefreshCw,
                  label: "Update Requested",
                  detail: "Collector or gallery requests a provenance update",
                },
                {
                  icon: UserCheck,
                  label: "Creator Approves",
                  detail: "Original artist reviews and approves the change",
                },
                {
                  icon: CheckCircle2,
                  label: "Certificate Updated",
                  detail: "Record is permanently updated with full audit trail",
                },
              ].map((step, i) => (
                <motion.div key={step.label} custom={i} variants={fadeUp} className="flex items-center gap-4 md:gap-0">
                  <div className="flex flex-col items-center text-center w-48">
                    <span className="w-14 h-14 rounded-full border border-parchment/15 bg-parchment/[0.05] flex items-center justify-center mb-3">
                      <step.icon className="w-6 h-6 text-parchment/70" strokeWidth={1.5} />
                    </span>
                    <p className="text-sm font-semibold text-parchment/90 mb-1">{step.label}</p>
                    <p className="text-xs text-parchment/50 leading-snug">{step.detail}</p>
                  </div>
                  {i < 2 && (
                    <ArrowRight className="hidden md:block w-5 h-5 text-parchment/25 mx-6 shrink-0" strokeWidth={1.5} />
                  )}
                </motion.div>
              ))}
            </motion.div>
            <p className="text-center mt-12 text-sm text-parchment/40">
              Our updateable certificate system is patent pending.
            </p>
          </div>
        </div>
      </LandingSection>

      {/* ── Section 3: Collection Management ── */}
      <LandingSection
        id="collection"
        className="w-full min-h-screen min-h-viewport flex flex-col justify-center"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-24 md:py-32">
          {/* Header */}
          <div className="text-center mb-16 md:mb-20">
            <div className="flex justify-center mb-6">
              <span className="bg-wine/10 p-3.5 rounded-xl inline-flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-wine/80" strokeWidth={1.5} />
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-ink mb-5">
              Collection Management
            </h2>
            <p className="text-lg md:text-xl font-light leading-relaxed text-ink/60 max-w-2xl mx-auto">
              The most complete collection management system built for the art world.
              One source of truth for every work in your care.
            </p>
          </div>

          {/* 2x2 feature grid */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              {
                icon: Receipt,
                title: "Invoicing",
                description:
                  "Create and send professional invoices directly from your collection. Track payments, generate PDFs, and keep your financial records alongside your art records.",
              },
              {
                icon: FileSignature,
                title: "Artwork Loan Agreements",
                description:
                  "Generate and manage loan agreements with a few clicks. Define terms, conditions, insurance requirements, and get digital signatures \u2014 all in one place.",
              },
              {
                icon: Tag,
                title: "Artwork Label Maker",
                description:
                  "Create print-ready labels for exhibitions and storage. Include artwork details, QR codes linking to certificates, and custom formatting for any display context.",
              },
              {
                icon: BookOpen,
                title: "Cataloging & Provenance",
                description:
                  "Full accessioning, provenance tracking, and location management. Record every detail \u2014 dimensions, medium, condition, exhibition history, and ownership chain.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                variants={fadeUp}
                className="group rounded-2xl border border-wine/8 bg-white/50 p-8 md:p-10 hover:shadow-lg hover:shadow-wine/5 transition-shadow"
              >
                <feature.icon className="w-7 h-7 text-wine/70 mb-5" strokeWidth={1.5} />
                <h3 className="text-xl font-semibold tracking-tight text-ink mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink/60">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center mt-12">
            <Link
              href="/subscription?role=collector"
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-wine text-parchment font-serif text-base font-medium hover:bg-wine/90 transition-colors shadow-sm"
            >
              Subscribe
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </LandingSection>

      {/* ── Section 4: Artist Toolbox ── */}
      <LandingSection
        id="tools"
        className="w-full min-h-screen min-h-viewport flex flex-col justify-center bg-wine"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-24 md:py-32">
          {/* Header */}
          <div className="text-center mb-16 md:mb-20">
            <div className="flex justify-center mb-6">
              <span className="bg-parchment/10 p-3.5 rounded-xl inline-flex items-center justify-center">
                <Palette className="w-8 h-8 text-parchment/80" strokeWidth={1.5} />
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-parchment mb-5">
              Artist Toolbox
            </h2>
            <p className="text-lg md:text-xl font-light leading-relaxed text-parchment/60 max-w-2xl mx-auto">
              Discover opportunities tailored to your practice.
              Upload your CV and let our AI match you with the right opportunities.
            </p>
          </div>

          {/* Three opportunity types */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            {[
              {
                icon: Award,
                title: "Grants",
                description:
                  "AI-powered grant discovery matched to your CV and artistic practice. We surface relevant funding opportunities so you can focus on your work, not endless searching.",
              },
              {
                icon: Building2,
                title: "Residencies",
                description:
                  "Find artist residencies worldwide, filtered by medium, location, and deadline. From remote retreats to urban studios \u2014 discover the right space for your next body of work.",
              },
              {
                icon: Megaphone,
                title: "Open Calls",
                description:
                  "Browse curated open calls for exhibitions, commissions, and publications. Stay ahead of deadlines with personalized recommendations based on your profile.",
              },
            ].map((tool, i) => (
              <motion.div
                key={tool.title}
                custom={i}
                variants={fadeUp}
                className="group rounded-2xl border border-parchment/10 bg-parchment/[0.05] p-8 md:p-10 hover:bg-parchment/[0.08] transition-colors"
              >
                <tool.icon className="w-7 h-7 text-parchment/60 mb-5" strokeWidth={1.5} />
                <h3 className="text-xl font-semibold tracking-tight text-parchment/95 mb-3">
                  {tool.title}
                </h3>
                <p className="text-sm leading-relaxed text-parchment/55">
                  {tool.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center mt-12">
            <Link
              href="/subscription?role=artist"
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-parchment text-wine font-serif text-base font-medium hover:bg-parchment/90 transition-colors shadow-sm"
            >
              Subscribe
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </LandingSection>

      <LandingStatsSection stats={platformStats} />
    </div>
  );
}
