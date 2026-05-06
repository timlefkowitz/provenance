import Link from "next/link";
import {
  Coins,
  Stamp,
  Layers,
  BookOpen,
  Trophy,
  Gamepad2,
  Watch,
  Gem,
  Wine,
  Crown,
  Sparkles,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { COLLECTIBLE_CATEGORIES } from "@provenance/planet-collectibles";

const META: Record<
  string,
  { icon: LucideIcon; label: string; copy: string; count: string }
> = {
  coins: {
    icon: Coins,
    label: "Coins & Currency",
    copy: "Numismatic rarities, ancient and modern.",
    count: "3,412",
  },
  stamps: {
    icon: Stamp,
    label: "Stamps",
    copy: "Philatelic issues, errors, and first-day covers.",
    count: "1,107",
  },
  "trading-cards": {
    icon: Layers,
    label: "Trading Cards",
    copy: "Graded slabs from PSA, BGS, CGC and SGC.",
    count: "5,820",
  },
  comics: {
    icon: BookOpen,
    label: "Comics",
    copy: "Key issues, golden, silver and modern age.",
    count: "942",
  },
  memorabilia: {
    icon: Trophy,
    label: "Memorabilia",
    copy: "Game-used, signed, and historical artifacts.",
    count: "2,165",
  },
  toys: {
    icon: Gamepad2,
    label: "Toys & Figures",
    copy: "Sealed vintage, prototypes and one-of-ones.",
    count: "1,388",
  },
  watches: {
    icon: Watch,
    label: "Watches",
    copy: "Horology with full chain of ownership.",
    count: "768",
  },
  jewelry: {
    icon: Gem,
    label: "Jewelry",
    copy: "GIA-certified stones and signed pieces.",
    count: "514",
  },
  wine: {
    icon: Wine,
    label: "Wine & Spirits",
    copy: "Cellar-tracked bottles with storage history.",
    count: "1,092",
  },
  antiques: {
    icon: Crown,
    label: "Antiques",
    copy: "Furniture, decorative arts, and curiosities.",
    count: "623",
  },
  other: {
    icon: Sparkles,
    label: "Other",
    copy: "Singular pieces beyond category.",
    count: "281",
  },
};

export function CategoryGrid() {
  return (
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-wine/15 bg-wine/15 sm:grid-cols-2 lg:grid-cols-3">
      {COLLECTIBLE_CATEGORIES.map((category) => {
        const meta = META[category];
        const Icon = meta?.icon ?? Sparkles;
        const label =
          meta?.label ??
          category
            .split("-")
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ");

        return (
          <li key={category}>
            <Link
              href={`/browse?category=${category}`}
              className="group relative flex h-full flex-col gap-6 bg-parchment p-6 transition-colors hover:bg-bone/60 sm:p-8"
            >
              <div className="flex items-center justify-between">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-wine/20 bg-parchment text-wine transition-colors group-hover:border-wine/50 group-hover:bg-wine group-hover:text-parchment"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <span className="font-cinzel text-[10px] font-medium tracking-[0.24em] text-ink/40">
                  {meta?.count ?? "—"} ITEMS
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <h3 className="font-cinzel text-lg font-semibold tracking-wide text-ink">
                  {label}
                </h3>
                <p className="font-cormorant text-base leading-relaxed text-ink/65">
                  {meta?.copy}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium tracking-[0.2em] text-wine/70 transition-colors group-hover:text-wine">
                <span className="font-cinzel">EXPLORE</span>
                <ArrowUpRight
                  className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
