import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type FeaturedPiece = {
  href: string;
  image: string;
  alt: string;
  category: string;
  title: string;
  attribution: string;
  certificate: string;
  grade: string;
};

const FEATURED: FeaturedPiece[] = [
  {
    href: "/browse?category=coins",
    image: "/images/featured-coin.jpg",
    alt: "Ancient gold coin photographed on oxblood velvet",
    category: "Coins & Currency",
    title: "Aureus of Augustus",
    attribution: "27 BC – 14 AD · Lugdunum mint",
    certificate: "PRV-9C2F-0418",
    grade: "NGC · Choice XF",
  },
  {
    href: "/browse?category=trading-cards",
    image: "/images/featured-card.jpg",
    alt: "Vintage graded trading card encapsulated in clear slab",
    category: "Trading Cards",
    title: "1952 Topps · Rookie",
    attribution: "Encapsulated, full-bleed centering",
    certificate: "PRV-44A1-7702",
    grade: "PSA · 8.5 NM-MT+",
  },
  {
    href: "/browse?category=watches",
    image: "/images/featured-watch.jpg",
    alt: "Vintage mechanical wristwatch with cream patina dial on parchment",
    category: "Watches",
    title: "Ref. 1675 · Tropical",
    attribution: "Original tritium dial, full set",
    certificate: "PRV-77E0-1A33",
    grade: "Provenance · Verified",
  },
];

export function FeaturedPieces() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
      {FEATURED.map((piece) => (
        <Link
          key={piece.certificate}
          href={piece.href}
          className="group flex flex-col gap-5"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-wine/15 bg-bone/40">
            <Image
              src={piece.image}
              alt={piece.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 33vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-parchment/40 bg-ink/40 px-3 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
              <span className="font-cinzel text-[10px] font-medium tracking-[0.22em] text-parchment">
                {piece.grade}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-cinzel text-[10px] font-medium tracking-[0.28em] text-wine">
              {piece.category}
            </span>
            <h3 className="font-cinzel text-xl font-semibold tracking-wide text-ink text-balance">
              {piece.title}
            </h3>
            <p className="font-cormorant text-base italic text-ink/65">
              {piece.attribution}
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-wine/15 pt-3">
              <span className="font-mono text-xs tracking-wider text-ink/50">
                {piece.certificate}
              </span>
              <span className="inline-flex items-center gap-1 font-cinzel text-[10px] font-medium tracking-[0.24em] text-wine transition-transform group-hover:-translate-y-0.5">
                VIEW
                <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
