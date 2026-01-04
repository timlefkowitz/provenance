import Link from "next/link";

export default function SectionPlaceholder({ title }: { title: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 font-serif text-center">
      <h1 className="font-display text-4xl sm:text-6xl mb-6 text-wine">{title}</h1>
      <div className="w-24 h-px bg-wine mb-8" />
      <p className="font-body text-xl italic opacity-70 mb-8">
        This section is currently being curated.
      </p>
      <Link href="/" className="border-b border-wine pb-1 hover:opacity-60 transition-opacity">
        &larr; Return to Journal
      </Link>
    </main>
  );
}

