import { ShieldCheck, ArrowRight } from "lucide-react";

type VerifyFormProps = {
  variant?: "hero" | "section";
  id?: string;
};

export function VerifyForm({ variant = "section", id }: VerifyFormProps) {
  const isHero = variant === "hero";

  return (
    <form
      action="/verify"
      method="get"
      id={id}
      className={
        isHero
          ? "group relative flex w-full flex-col gap-2 rounded-full border border-wine/25 bg-parchment p-1.5 shadow-[0_1px_0_rgba(74,47,37,0.04)] sm:flex-row sm:items-center"
          : "flex w-full max-w-xl flex-col gap-2 sm:flex-row"
      }
      aria-label="Verify a Provenance certificate"
    >
      <div
        className={
          isHero
            ? "flex flex-1 items-center gap-3 px-4"
            : "flex flex-1 items-center gap-3 rounded-md border border-wine/25 bg-parchment px-4"
        }
      >
        <ShieldCheck
          className="h-4 w-4 shrink-0 text-wine/70"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <label htmlFor={`${id ?? "verify"}-number`} className="sr-only">
          Certificate number
        </label>
        <input
          id={`${id ?? "verify"}-number`}
          name="certificate"
          type="text"
          inputMode="text"
          autoComplete="off"
          required
          minLength={4}
          placeholder="Enter certificate number, e.g. PRV-7C4F-29A1"
          className="h-11 w-full bg-transparent font-cormorant text-base text-ink placeholder:text-ink/40 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className={
          isHero
            ? "group/btn inline-flex h-11 items-center justify-center gap-2 rounded-full bg-wine px-6 font-cinzel text-xs font-semibold tracking-[0.22em] text-parchment transition-colors hover:bg-ink"
            : "group/btn inline-flex h-11 items-center justify-center gap-2 rounded-md bg-wine px-6 font-cinzel text-xs font-semibold tracking-[0.22em] text-parchment transition-colors hover:bg-ink"
        }
      >
        VERIFY
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5"
          strokeWidth={2}
        />
      </button>
    </form>
  );
}
