import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Blocks,
  Building2,
  Database,
  FileCheck2,
  Globe2,
  History,
  Mail,
  Map,
  Plug,
  Quote,
  Sparkles,
  User,
} from "lucide-react";
import { AboutReveal } from "@/components/about-reveal";
import { getAboutContent } from "../admin/about/_actions/about-content";

export const metadata = {
  title: "About | Provenance",
  description:
    "Learn about Provenance: certificates, institutional tools, provenance tracking, APIs, roadmap for blockchain and physical COAs, data compliance, and planets.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium tracking-[0.25em] text-wine/70 uppercase">
      {children}
    </span>
  );
}

const serviceIcons = [FileCheck2, Building2, Plug, History] as const;

const roadmapIcons = [Blocks, Mail, Database, Globe2] as const;

export default async function AboutPage() {
  const content = await getAboutContent();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-parchment font-landing text-ink selection:bg-wine/15">
      {/* Atmospheric backdrop */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute -top-32 left-1/2 h-[min(90vw,720px)] w-[min(90vw,720px)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.12)_0%,transparent_68%)]" />
        <div className="absolute top-[40vh] -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.06)_0%,transparent_70%)] blur-2xl" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-wine/15 to-transparent" />
      </div>

      {/* Hero */}
      <header className="relative flex min-h-[72vh] min-h-viewport flex-col items-center justify-center px-6 pb-16 pt-28 text-center sm:px-10">
        <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both flex max-w-4xl flex-col items-center gap-8 duration-700">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-px w-12 bg-wine/35" />
            <SectionLabel>Our story</SectionLabel>
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-[0.06em] text-wine sm:text-6xl md:text-7xl lg:text-8xl lg:tracking-[0.1em]">
            {content.header.title}
          </h1>
          <p className="max-w-2xl text-pretty text-base font-light leading-relaxed tracking-wide text-ink/65 sm:text-lg md:text-xl">
            {content.header.subtitle}
          </p>
          <div className="flex h-px w-12 bg-wine/35" />
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-24 px-6 pb-28 sm:px-10 md:space-y-32 md:pb-36">
        {/* Mission */}
        <AboutReveal>
          <section
            className="relative grid gap-10 md:grid-cols-[auto_1fr] md:gap-14"
            aria-labelledby="about-mission-heading"
          >
            <div className="hidden md:flex md:w-12 md:justify-center">
              <div className="h-full w-px bg-gradient-to-b from-wine/40 via-wine/15 to-transparent" />
            </div>
            <div className="rounded-3xl border border-wine/10 bg-white/45 p-8 shadow-sm ring-1 ring-wine/5 backdrop-blur-sm sm:p-10 md:p-14">
              <div className="mb-6 flex items-center gap-3 text-wine/80">
                <Sparkles className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                <SectionLabel>Mission</SectionLabel>
              </div>
              <h2
                id="about-mission-heading"
                className="mb-8 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
              >
                {content.mission.title}
              </h2>
              <div className="space-y-6 text-base leading-relaxed text-ink/75 md:text-lg">
                {content.mission.paragraphs.map((para, idx) => (
                  <p key={idx} dangerouslySetInnerHTML={{ __html: para }} />
                ))}
              </div>
            </div>
          </section>
        </AboutReveal>

        {/* What we provide */}
        <AboutReveal>
          <section aria-labelledby="about-services-heading">
            <div className="mb-12 text-center md:mb-16">
              <SectionLabel>Platform</SectionLabel>
              <h2
                id="about-services-heading"
                className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
              >
                {content.whatWeProvide.title}
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {content.whatWeProvide.sections.map((section, idx) => {
                const Icon = serviceIcons[idx] ?? FileCheck2;
                return (
                  <div
                    key={`${section.title}-${idx}`}
                    className="group flex flex-col rounded-2xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-wine/5"
                  >
                    <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-wine/10 text-wine transition-colors group-hover:bg-wine/15">
                      <Icon className="h-6 w-6" strokeWidth={1.5} />
                    </span>
                    <h3 className="mb-3 text-xl font-semibold tracking-tight text-ink">
                      {section.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">
                      {section.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </AboutReveal>

        {/* Why it matters */}
        <AboutReveal>
          <section
            className="overflow-hidden rounded-3xl border border-wine/10 bg-gradient-to-br from-wine/[0.07] via-parchment to-parchment shadow-sm ring-1 ring-wine/5"
            aria-labelledby="about-why-heading"
          >
            <div className="grid gap-0 md:grid-cols-2">
              <div className="flex flex-col justify-center border-b border-wine/10 p-10 md:border-b-0 md:border-r md:p-14 lg:p-16">
                <Quote
                  className="mb-6 h-10 w-10 text-wine/35"
                  strokeWidth={1}
                  aria-hidden
                />
                <SectionLabel>Perspective</SectionLabel>
                <h2
                  id="about-why-heading"
                  className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
                >
                  {content.whyItMatters.title}
                </h2>
              </div>
              <div className="space-y-6 p-10 text-base leading-relaxed text-ink/75 md:p-14 lg:p-16 md:text-lg">
                {content.whyItMatters.paragraphs.map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>
            </div>
          </section>
        </AboutReveal>

        {/* Founders */}
        <AboutReveal>
          <section aria-labelledby="about-founders-heading">
            <div className="mb-12 text-center md:mb-16">
              <SectionLabel>People</SectionLabel>
              <h2
                id="about-founders-heading"
                className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
              >
                {content.founders.title}
              </h2>
            </div>
            <div className="flex flex-col gap-10 md:gap-14">
              {content.founders.founders.map((founder, idx) => (
                <article
                  key={founder.name}
                  className={`flex flex-col items-stretch gap-10 rounded-3xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 backdrop-blur-sm sm:p-10 md:flex-row md:items-center md:gap-12 lg:p-12 ${
                    idx % 2 === 1 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className="shrink-0 md:w-[min(100%,320px)]">
                    {founder.photo_url ? (
                      <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-2xl shadow-lg ring-1 ring-wine/10 md:mx-0 md:max-w-none">
                        <Image
                          src={founder.photo_url}
                          alt={founder.name}
                          fill
                          className="object-cover"
                          sizes="(min-width: 768px) 320px, 280px"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="relative mx-auto flex aspect-[3/4] w-full max-w-[280px] items-center justify-center rounded-2xl bg-wine/[0.06] ring-1 ring-wine/10 md:mx-0 md:max-w-none">
                        <User className="h-16 w-16 text-wine/25" strokeWidth={1} aria-hidden />
                        <span className="sr-only">Photo coming soon</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-4">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                        {founder.name}
                      </h3>
                      <p className="mt-1 text-sm font-medium tracking-wide text-wine/80">
                        {founder.role}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-ink/70 md:text-base">
                      {founder.bio}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </AboutReveal>

        {/* Roadmap */}
        <AboutReveal>
          <section
            className="relative"
            aria-labelledby="about-roadmap-heading"
          >
            <div
              className="pointer-events-none absolute inset-x-0 -top-6 flex justify-center"
              aria-hidden
            >
              <div className="h-16 w-px bg-gradient-to-b from-transparent via-wine/25 to-transparent" />
            </div>
            <div className="relative overflow-hidden rounded-[2rem] border border-wine/12 bg-gradient-to-b from-white/60 via-parchment to-wine/[0.04] p-8 shadow-[0_32px_90px_-40px_rgba(74,47,37,0.22)] ring-1 ring-wine/[0.06] backdrop-blur-sm sm:p-10 md:p-12">
              <div
                className="pointer-events-none absolute -right-24 top-1/2 h-[min(70vw,420px)] w-[min(70vw,420px)] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.06)_0%,transparent_65%)]"
                aria-hidden
              />
              <div className="relative mx-auto max-w-3xl text-center">
                <div className="mb-5 flex flex-col items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-wine/10 bg-white/50 text-wine shadow-sm">
                    <Map className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <SectionLabel>Horizon</SectionLabel>
                </div>
                <h2
                  id="about-roadmap-heading"
                  className="text-balance text-3xl font-semibold tracking-tight text-ink md:text-4xl lg:text-[2.5rem]"
                >
                  {content.roadmap.title}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-ink/60 md:text-base">
                  What we are building next with artists and partners—layered onto the same
                  platform you use today, so nothing you publish now is left behind.
                </p>
              </div>
              <div className="relative mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
                {content.roadmap.sections.map((item, idx) => {
                  const Icon = roadmapIcons[idx] ?? Blocks;
                  return (
                    <div
                      key={`${item.title}-${idx}`}
                      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-wine/10 bg-white/55 p-6 shadow-sm ring-1 ring-black/[0.02] transition-all duration-300 hover:-translate-y-0.5 hover:border-wine/18 hover:bg-white/70 hover:shadow-lg hover:shadow-wine/10 md:p-7"
                    >
                      <div
                        className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-wine/35 via-wine/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        aria-hidden
                      />
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wine/[0.09] text-wine transition-colors duration-300 group-hover:bg-wine/[0.14]">
                          <Icon className="h-5 w-5" strokeWidth={1.5} />
                        </span>
                        <span className="select-none pt-0.5 font-mono text-[10px] font-medium tabular-nums tracking-widest text-wine/35">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <h3 className="mb-2.5 text-lg font-semibold tracking-tight text-ink md:text-xl">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">
                        {item.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </AboutReveal>

        {/* CTA */}
        <AboutReveal>
          <section
            className="relative overflow-hidden rounded-3xl bg-wine px-8 py-14 text-center text-parchment shadow-xl ring-1 ring-wine/20 sm:px-12 md:py-16"
            aria-labelledby="about-cta-heading"
          >
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-parchment/10 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-parchment/5 blur-2xl"
              aria-hidden
            />
            <h2
              id="about-cta-heading"
              className="relative text-3xl font-semibold tracking-tight text-parchment md:text-4xl"
            >
              {content.callToAction.title}
            </h2>
            <p className="relative mx-auto mt-5 max-w-2xl text-base font-light leading-relaxed text-parchment/75 md:text-lg">
              {content.callToAction.description}
            </p>
            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/artworks/add"
                className="group inline-flex items-center gap-2 rounded-xl bg-parchment px-8 py-3.5 text-sm font-medium text-wine shadow-sm transition-colors hover:bg-parchment/90"
              >
                Add your first artwork
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </Link>
              <Link
                href="/artworks"
                className="inline-flex items-center gap-2 rounded-xl border border-parchment/35 px-8 py-3.5 text-sm font-medium text-parchment/95 transition-colors hover:bg-parchment/10"
              >
                Browse artworks
              </Link>
            </div>
          </section>
        </AboutReveal>
      </div>

      <footer className="border-t border-wine/10 px-6 py-12 text-center text-sm text-ink/50 sm:px-10">
        <p>
          © {new Date().getFullYear()} Provenance Platform.
          {" · "}
          <Link href="/" className="text-wine/80 underline-offset-4 hover:underline">
            Home
          </Link>
        </p>
      </footer>
    </main>
  );
}
