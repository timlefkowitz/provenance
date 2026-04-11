import { PROPERTY_TYPES } from "@provenance/planet-realestate";

export default function RealEstateHome() {
  return (
    <main className="min-h-viewport flex flex-col items-center px-4 py-16 sm:px-8">
      <header className="w-full max-w-4xl text-center mb-16">
        <h1 className="font-cinzel text-5xl sm:text-7xl font-bold tracking-tight text-wine mb-4">
          REAL ESTATE
        </h1>
        <p className="text-lg text-ink/70 max-w-2xl mx-auto">
          Verify property provenance, track deed history, and manage title
          documentation for real estate assets.
        </p>
      </header>

      <section className="w-full max-w-4xl">
        <h2 className="font-cinzel text-2xl text-wine mb-8 text-center">
          Property Types
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {PROPERTY_TYPES.map((type) => (
            <a
              key={type}
              href={`/browse?type=${type}`}
              className="flex flex-col items-center justify-center p-6 border border-wine/20 rounded-lg hover:border-wine/40 hover:bg-wine/5 transition-all"
            >
              <span className="text-sm font-medium capitalize text-ink/80">
                {type.replace("-", " ")}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="w-full max-w-4xl mt-16 text-center">
        <h2 className="font-cinzel text-2xl text-wine mb-4">
          Verify a Property Title
        </h2>
        <p className="text-ink/60 mb-8">
          Enter a certificate number or parcel number to verify the provenance
          and title history of any registered property.
        </p>
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Certificate or parcel number..."
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
