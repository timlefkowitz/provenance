import { COLLECTIBLE_CATEGORIES } from "@provenance/planet-collectibles";

export default function CollectiblesHome() {
  return (
    <main className="min-h-viewport flex flex-col items-center px-4 py-16 sm:px-8">
      <header className="w-full max-w-4xl text-center mb-16">
        <h1 className="font-cinzel text-5xl sm:text-7xl font-bold tracking-tight text-wine mb-4">
          COLLECTIBLES
        </h1>
        <p className="text-lg text-ink/70 max-w-2xl mx-auto">
          Authenticate, verify, and track provenance for coins, cards,
          memorabilia, and other collectible items.
        </p>
      </header>

      <section className="w-full max-w-4xl">
        <h2 className="font-cinzel text-2xl text-wine mb-8 text-center">
          Categories
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {COLLECTIBLE_CATEGORIES.map((category) => (
            <a
              key={category}
              href={`/browse?category=${category}`}
              className="flex flex-col items-center justify-center p-6 border border-wine/20 rounded-lg hover:border-wine/40 hover:bg-wine/5 transition-all"
            >
              <span className="text-sm font-medium capitalize text-ink/80">
                {category.replace("-", " ")}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="w-full max-w-4xl mt-16 text-center">
        <h2 className="font-cinzel text-2xl text-wine mb-4">
          Verify a Collectible
        </h2>
        <p className="text-ink/60 mb-8">
          Enter a certificate number to verify the authenticity and provenance
          of any registered collectible.
        </p>
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Enter certificate number..."
            className="flex-1 rounded-md border border-wine/30 bg-white/50 px-4 py-2 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-wine/30"
          />
          <button className="rounded-md bg-wine px-6 py-2 text-sm font-medium text-white hover:bg-wine/90 transition-colors">
            Verify
          </button>
        </div>
      </section>
    </main>
  );
}
