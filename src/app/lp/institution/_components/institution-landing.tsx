import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  FileStack,
  Handshake,
  Layers3,
  MousePointerClick,
  Package,
  Quote,
  Receipt,
  Sparkles,
  Tag,
} from "lucide-react";

import { AboutReveal } from "@/components/about-reveal";
import { PERSONA_LANDING_PAGES } from "../../../../../makerkit/nextjs-saas-starter-kit-lite/apps/web/app/(marketing)/lp/_components/persona-landing-data";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium tracking-[0.25em] text-wine/70 uppercase">
      {children}
    </span>
  );
}

const config = PERSONA_LANDING_PAGES.institution;

const certificateTypes = [
  {
    title: "Certificate of authenticity",
    body: "Artist-anchored authenticity that travels with the object and stays aligned with curatorial files.",
    icon: FileCheck2,
  },
  {
    title: "Certificate of ownership",
    body: "Clear title and custodial context so acquisitions, donors, and deaccessions stay auditable.",
    icon: Handshake,
  },
  {
    title: "Certificate of intermediary",
    body: "Dealers, lenders, and registrars meet in the middle—documenting the handoff without fragmenting the record.",
    icon: Layers3,
  },
] as const;

const collectionPins = [
  {
    title: "Provenance-first, not spreadsheet-first",
    body: "Accession, location, and exhibition history stay tied to the same certificate graph your partners verify.",
  },
  {
    title: "One source of truth across departments",
    body: "Curatorial, registrar, and development views pull from shared records—fewer reconciliations before a loan or audit.",
  },
  {
    title: "Append-only events you can defend",
    body: "Custody changes and internal movements emit transparent events instead of silent edits buried in a TMS export.",
  },
  {
    title: "Built for public trust",
    body: "Verification-friendly certificates and APIs meet institutions where donors, boards, and traveling shows expect clarity.",
  },
] as const;

const operationsFeatures = [
  {
    title: "Invoicing",
    description:
      "Create and send professional invoices directly from your collection. Track payments, generate PDFs, and keep your financial records alongside your art records.",
    icon: Receipt,
  },
  {
    title: "Artwork loan agreements",
    description:
      "Generate and manage loan agreements with a few clicks. Define terms, conditions, insurance requirements, and get digital signatures — all in one place.",
    icon: FileStack,
  },
  {
    title: "Artwork label maker",
    description:
      "Create print-ready labels for exhibitions and storage. Include artwork details, QR codes linking to certificates, and custom formatting for any display context.",
    icon: Tag,
  },
  {
    title: "Exhibitions checklist",
    description:
      "Coordinate install, condition checks, lender requirements, and registrar sign-offs on one checklist tied to the exhibition record—so curatorial, prep, and front-of-house stay aligned from load-in through deinstall.",
    icon: ClipboardList,
  },
  {
    title: "Cataloging & provenance",
    description:
      "Full accessioning, provenance tracking, and location management. Record every detail — dimensions, medium, condition, exhibition history, and ownership chain.",
    icon: Package,
  },
] as const;

export function InstitutionLanding() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-parchment font-landing text-ink selection:bg-wine/15">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-[min(90vw,720px)] w-[min(90vw,720px)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.12)_0%,transparent_68%)]" />
        <div className="absolute top-[40vh] -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(74,47,37,0.06)_0%,transparent_70%)] blur-2xl" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-wine/15 to-transparent" />
      </div>

      <header className="relative flex min-h-[72vh] min-h-viewport flex-col items-center justify-center px-6 pb-16 pt-28 text-center sm:px-10">
        <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both flex max-w-4xl flex-col items-center gap-8 duration-700">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-px w-12 bg-wine/35" />
            <SectionLabel>{config.pill}</SectionLabel>
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-[0.04em] text-wine sm:text-5xl md:text-6xl lg:text-7xl lg:tracking-[0.08em]">
            Institutional tools that keep collections accountable—and help artists grow
          </h1>
          <p className="max-w-2xl text-pretty text-base font-light leading-relaxed tracking-wide text-ink/65 sm:text-lg md:text-xl">
            Align registrar workflows, certificates, and collection operations on one platform. When
            institutions run cleaner records, artists benefit from clearer authenticity, faster
            verification, and less friction every time work moves between studio, market, and public
            trust.
          </p>
          <ul className="mt-10 max-w-2xl space-y-3 text-left">
            {config.outcomes.map((line) => (
              <li
                key={line}
                className="flex gap-3 text-sm leading-relaxed text-ink/70 md:text-base"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wine/10 text-wine">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-24 px-6 pb-28 sm:px-10 md:space-y-32 md:pb-36">
        <AboutReveal>
          <section
            className="relative grid gap-10 md:grid-cols-[auto_1fr] md:gap-14"
            aria-labelledby="inst-shared-cert-heading"
          >
            <div className="hidden md:flex md:w-12 md:justify-center">
              <div className="h-full w-px bg-gradient-to-b from-wine/40 via-wine/15 to-transparent" />
            </div>
            <div className="rounded-3xl border border-wine/10 bg-white/45 p-8 shadow-sm ring-1 ring-wine/5 backdrop-blur-sm sm:p-10 md:p-14">
              <div className="mb-6 flex items-center gap-3 text-wine/80">
                <Sparkles className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                <SectionLabel>Certificates</SectionLabel>
              </div>
              <h2
                id="inst-shared-cert-heading"
                className="mb-6 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
              >
                One registry: authenticity, ownership, and intermediary in sync
              </h2>
              <p className="mb-10 text-base leading-relaxed text-ink/75 md:text-lg">
                Certificates of authenticity, ownership, and intermediary share the same underlying
                record—so curatorial narrative, legal title, and market handoffs never drift into
                conflicting PDFs. Provenance transfers with a structured handoff: counterparties
                review the package and{" "}
                <span className="font-medium text-ink">accept with one click</span> to advance
                custody and visibility, instead of re-keying data across inboxes.
              </p>
              <div className="grid gap-6 sm:grid-cols-3">
                {certificateTypes.map(({ title, body, icon: Icon }) => (
                  <div
                    key={title}
                    className="flex flex-col rounded-2xl border border-wine/10 bg-white/60 p-6 shadow-sm ring-1 ring-wine/5"
                  >
                    <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-wine/10 text-wine">
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <h3 className="mb-2 text-lg font-semibold tracking-tight text-ink">{title}</h3>
                    <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">{body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-wrap items-start gap-4 rounded-2xl border border-wine/10 bg-wine/[0.04] p-6 ring-1 ring-wine/5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wine/10 text-wine">
                  <MousePointerClick className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-ink md:text-base">
                    One-click accept for provenance transfers
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink/65 md:text-[15px]">
                    Bundle condition, certificates, and event history into a single transfer. The
                    receiving institution or collector confirms in one action—preserving a
                    defensible timeline for loans, acquisitions, and outgoing movement alike.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </AboutReveal>

        <AboutReveal>
          <section aria-labelledby="inst-collection-heading">
            <div className="mb-12 text-center md:mb-16">
              <SectionLabel>Collection management</SectionLabel>
              <h2
                id="inst-collection-heading"
                className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
              >
                Built for registrars—not generic inventory software
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink/65 md:text-lg">
                Most tools stop at object IDs and locations. Provenance couples collection
                management with certificates, events, and verification so the record you maintain
                inside the building matches what partners see outside it.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
              {collectionPins.map((item) => (
                <div
                  key={item.title}
                  className="group flex flex-col rounded-2xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-wine/5"
                >
                  <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-wine/10 text-wine transition-colors group-hover:bg-wine/15">
                    <Building2 className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <h3 className="mb-3 text-xl font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        </AboutReveal>

        <AboutReveal>
          <section aria-labelledby="inst-operations-heading">
            <div className="mb-12 text-center md:mb-16">
              <SectionLabel>Operations</SectionLabel>
              <h2
                id="inst-operations-heading"
                className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
              >
                From catalog to contracts—without leaving the collection record
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
              {operationsFeatures.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="group flex flex-col rounded-2xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-wine/5"
                >
                  <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-wine/10 text-wine transition-colors group-hover:bg-wine/15">
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <h3 className="mb-3 text-xl font-semibold tracking-tight text-ink">{title}</h3>
                  <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </AboutReveal>

        <AboutReveal>
          <section aria-labelledby="inst-proof-heading">
            <div className="mb-12 text-center md:mb-16">
              <SectionLabel>Platform depth</SectionLabel>
              <h2
                id="inst-proof-heading"
                className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-5xl"
              >
                {config.proofSectionTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink/60">
                We are shipping evidence as fast as we ship code—placeholders mark what is coming
                next.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {config.proofCards.map((card) => (
                <div
                  key={card.title}
                  className="group flex flex-col rounded-2xl border border-wine/10 bg-white/50 p-8 shadow-sm ring-1 ring-wine/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-wine/5"
                >
                  {card.badge ? (
                    <span className="mb-4 w-fit rounded-full border border-wine/15 bg-wine/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-wine/85">
                      {card.badge}
                    </span>
                  ) : null}
                  <h3 className="mb-3 text-xl font-semibold tracking-tight text-ink">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-ink/65 md:text-[15px]">{card.body}</p>
                </div>
              ))}
            </div>
          </section>
        </AboutReveal>

        <AboutReveal>
          <section
            className="overflow-hidden rounded-3xl border border-wine/10 bg-gradient-to-br from-wine/[0.07] via-parchment to-parchment shadow-sm ring-1 ring-wine/5"
            aria-labelledby="inst-quote-heading"
          >
            <div className="grid gap-0 md:grid-cols-2">
              <div className="flex flex-col justify-center border-b border-wine/10 p-10 md:border-b-0 md:border-r md:p-14 lg:p-16">
                <Quote className="mb-6 h-10 w-10 text-wine/35" strokeWidth={1} aria-hidden />
                <SectionLabel>Perspective</SectionLabel>
                <h2
                  id="inst-quote-heading"
                  className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
                >
                  What registrars are telling us
                </h2>
              </div>
              <div className="space-y-6 p-10 text-base leading-relaxed text-ink/75 md:p-14 lg:p-16 md:text-lg">
                <blockquote className="text-lg font-medium leading-relaxed text-ink md:text-xl">
                  “{config.testimonial.quote}”
                </blockquote>
                <p className="text-sm text-ink/60">{config.testimonial.attribution}</p>
                <p className="text-xs italic text-ink/50">{config.testimonial.statusNote}</p>
              </div>
            </div>
          </section>
        </AboutReveal>

        <AboutReveal>
          <section aria-labelledby="inst-faq-heading">
            <div className="mb-10 text-center md:mb-12">
              <SectionLabel>FAQ</SectionLabel>
              <h2
                id="inst-faq-heading"
                className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
              >
                Common questions
              </h2>
            </div>
            <div className="mx-auto max-w-3xl space-y-3">
              {config.faqs.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-wine/10 bg-white/50 shadow-sm ring-1 ring-wine/5 open:shadow-md"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.question}
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-wine/45 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden
                      />
                    </span>
                  </summary>
                  <p className="border-t border-wine/10 px-5 pb-4 pt-3 text-sm leading-relaxed text-ink/65">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </AboutReveal>

        <AboutReveal>
          <section
            className="relative overflow-hidden rounded-3xl bg-wine px-8 py-14 text-center text-parchment shadow-xl ring-1 ring-wine/20 sm:px-12 md:py-16"
            aria-labelledby="inst-cta-heading"
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
              id="inst-cta-heading"
              className="relative text-3xl font-semibold tracking-tight text-parchment md:text-4xl"
            >
              Bring certificates, collection ops, and provenance into one workflow
            </h2>
            <p className="relative mx-auto mt-5 max-w-2xl text-base font-light leading-relaxed text-parchment/75 md:text-lg">
              Subscribe to align your team on a registry-shaped record that scales from accessioning
              desks to partner verification APIs.
            </p>
            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={config.cta.href}
                className="group inline-flex items-center gap-2 rounded-xl bg-parchment px-8 py-3.5 text-sm font-medium text-wine shadow-sm transition-colors hover:bg-parchment/90"
              >
                {config.cta.label}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-xl border border-parchment/35 px-8 py-3.5 text-sm font-medium text-parchment/95 transition-colors hover:bg-parchment/10"
              >
                Read our story
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
          {" · "}
          <Link href="/about" className="text-wine/80 underline-offset-4 hover:underline">
            About
          </Link>
        </p>
      </footer>
    </main>
  );
}
