import Image from 'next/image';

const founders = [
  {
    name: 'Timothy Lefkowitz',
    title: 'Co-Founder & CEO',
    bio: 'Building the infrastructure layer for art provenance and authenticity at scale.',
    initials: 'TL',
    accent: 'from-violet-500 to-indigo-600',
  },
  {
    name: 'Taco',
    title: 'Chief Vibes Officer',
    bio: 'Oversees morale, naps strategically, and ensures the office remains warm. Has never missed a standup — mostly because he\'s always in the chair.',
    isTaco: true,
  },
];

export function FoundersSection() {
  return (
    <section className="container mx-auto max-w-5xl px-4">
      <div className="mb-12 text-center">
        <p className="text-primary mb-3 text-sm font-semibold tracking-widest uppercase">
          The team
        </p>
        <h2 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
          Built by people who care about art
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base">
          We're artists, collectors, and technologists who got tired of
          certificates living in email threads and provenance dying with the
          seller.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-8">
        {founders.map((founder) =>
          founder.isTaco ? (
            <TacoFounderCard key={founder.name} {...founder} />
          ) : (
            <FounderCard key={founder.name} {...founder} />
          ),
        )}
      </div>
    </section>
  );
}

function FounderCard({
  name,
  title,
  bio,
  initials,
  accent,
}: {
  name: string;
  title: string;
  bio: string;
  initials?: string;
  accent?: string;
}) {
  return (
    <div className="group border-border bg-card flex w-full max-w-[320px] flex-col items-center rounded-2xl border p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div
        className={`bg-gradient-to-br ${accent} mb-5 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg`}
      >
        {initials}
      </div>
      <h3 className="text-foreground text-lg font-semibold">{name}</h3>
      <p className="text-primary mt-1 text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{bio}</p>
    </div>
  );
}

function TacoFounderCard({
  name,
  title,
  bio,
}: {
  name: string;
  title: string;
  bio: string;
}) {
  return (
    <div className="group border-border bg-card relative flex w-full max-w-[320px] flex-col items-center overflow-hidden rounded-2xl border p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      {/* subtle pink glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(244,114,182,0.12),_transparent_70%)]" />

      <div className="relative mb-5 h-20 w-20 overflow-hidden rounded-full border-2 border-pink-300/40 shadow-lg ring-2 ring-pink-400/20">
        <Image
          src="/taco-cat.png"
          alt="Taco the Cat"
          fill
          className="object-cover object-top"
          sizes="80px"
        />
      </div>

      <h3 className="text-foreground text-lg font-semibold">{name}</h3>
      <p className="mt-1 text-sm font-medium text-pink-500 dark:text-pink-400">
        {title}
      </p>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{bio}</p>

      <span className="mt-4 inline-block rounded-full bg-pink-100 px-3 py-1 text-xs font-medium text-pink-700 dark:bg-pink-950/50 dark:text-pink-300">
        🐾 &nbsp;Not hiring for this role
      </span>
    </div>
  );
}
