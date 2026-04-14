"use client";

import { motion } from "framer-motion";

import { LandingCountUp } from "@/components/landing-count-up";
import type { LandingPlatformStats } from "@/lib/landing-platform-stats.types";

type LandingStatsSectionProps = {
  stats: LandingPlatformStats;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-medium tracking-[0.25em] text-wine/70 uppercase">
      {children}
    </span>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" },
  }),
};

export function LandingStatsSection({ stats }: LandingStatsSectionProps) {
  const items = [
    { label: "Users", value: stats.users },
    { label: "Galleries", value: stats.galleries },
    { label: "Artworks stored", value: stats.artworks },
  ] as const;

  return (
    <section
      className="w-full border-t border-wine/10 bg-parchment"
      aria-labelledby="landing-stats-heading"
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-20 md:py-28">
        <div className="text-center mb-12 md:mb-16">
          <SectionLabel>Platform</SectionLabel>
          <h2
            id="landing-stats-heading"
            className="mt-4 text-2xl md:text-4xl font-semibold tracking-tight text-ink"
          >
            The network in numbers
          </h2>
          <p className="mt-3 text-sm md:text-base font-light text-ink/60 max-w-xl mx-auto">
          Grassroots network of artists, collectors, and galleries</p>
        </div>

        <motion.ul
          className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
        >
          {items.map((item, i) => (
            <motion.li
              key={item.label}
              custom={i}
              variants={fadeUp}
              className="text-center md:text-left rounded-2xl border border-wine/10 bg-white/40 px-8 py-10 md:py-12 shadow-sm ring-1 ring-wine/5"
            >
              <LandingCountUp
                target={item.value}
                className="block text-4xl md:text-5xl font-semibold tabular-nums tracking-tight text-wine"
              />
              <span className="mt-3 block text-xs md:text-sm font-medium tracking-[0.2em] text-ink/50 uppercase">
                {item.label}
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
