import { cn } from '@kit/ui/utils';

// Editorial form vocabulary — borrowed from the navbar: JetBrains Mono
// uppercase labels at 0.18em tracking, ink hairlines, square corners, and a
// vermillion rule that appears on focus (like the nav link underline).
// Pass these as className overrides to the @kit/ui primitives.

export const FIELD_LABEL =
  'font-jetbrains text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-editorial-ink/60';

export const FIELD_INPUT =
  'h-11 rounded-none border-0 border-b border-editorial-border/30 bg-transparent px-0 font-serif text-base md:text-base text-editorial-ink shadow-none transition-colors placeholder:text-editorial-ink/35 hover:border-editorial-border/60 focus-visible:border-b-vermillion focus-visible:ring-0 focus-visible:shadow-[0_1px_0_0_var(--vermillion)]';

export const FIELD_TEXTAREA =
  'min-h-[96px] resize-none rounded-none border border-editorial-border/25 bg-cream/50 px-3.5 py-3 font-serif text-base md:text-base text-editorial-ink shadow-none transition-colors placeholder:text-editorial-ink/35 hover:border-editorial-border/50 focus-visible:border-vermillion focus-visible:ring-0';

export const FIELD_HINT = 'font-serif text-xs text-editorial-ink/50';

const BUTTON_BASE =
  'h-11 rounded-none px-5 font-jetbrains text-[11px] font-medium uppercase tracking-[0.18em] shadow-none transition-colors focus-visible:ring-2 focus-visible:ring-vermillion/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bone';

export const BUTTON_PRIMARY = cn(
  BUTTON_BASE,
  'bg-editorial-ink text-bone hover:bg-editorial-ink/85',
);

export const BUTTON_SECONDARY = cn(
  BUTTON_BASE,
  'border border-editorial-border/30 bg-transparent text-editorial-ink hover:border-editorial-border hover:bg-editorial-ink/[0.04]',
);

/** Numbered section rule: `01 ── PROPOSED CHANGES ─────────` */
export function FieldSection({
  index,
  title,
  className,
}: {
  index: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="font-jetbrains text-[10px] font-medium tracking-[0.18em] text-vermillion">
        {index}
      </span>
      <h3 className="font-jetbrains text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-editorial-ink">
        {title}
      </h3>
      <span aria-hidden className="h-px flex-1 bg-editorial-border/20" />
    </div>
  );
}

/** Gilt mono kicker with a trailing hairline, as in the navbar dropdowns. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-jetbrains text-[10px] font-medium uppercase tracking-[0.2em] text-gilt">
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-editorial-border/40" />
    </div>
  );
}

/** Page title in the wordmark's voice: Fraunces italic with a vermillion full stop. */
export function EditorialPageHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-10', className)}>
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h1 className="font-fraunces text-4xl italic leading-[1.05] tracking-tight text-editorial-ink sm:text-5xl">
        {title}
        <span className="text-vermillion">.</span>
      </h1>
      {description && (
        <p className="mt-3 max-w-2xl font-serif text-base text-editorial-ink/60">{description}</p>
      )}
    </header>
  );
}

/** Section opener for long editorial pages: kicker, italic heading, short lede. */
export function EditorialSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
      <h2 className="font-fraunces text-2xl italic tracking-tight text-editorial-ink">{title}</h2>
      {description && (
        <p className="mt-2 max-w-2xl font-serif text-sm text-editorial-ink/55">{description}</p>
      )}
    </div>
  );
}

/** Square status tag in mono caps. */
export const TAG =
  'inline-flex items-center border px-2 py-0.5 font-jetbrains text-[10px] font-medium uppercase tracking-[0.16em]';
