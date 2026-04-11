export default function VehiclesHome() {
  return (
    <main className="min-h-viewport flex flex-col items-center px-4 py-16 sm:px-8">
      <header className="w-full max-w-4xl text-center mb-16">
        <h1 className="font-cinzel text-5xl sm:text-7xl font-bold tracking-tight text-wine mb-4">
          VEHICLES
        </h1>
        <p className="text-lg text-ink/70 max-w-2xl mx-auto">
          Verify vehicle history, validate VINs, and track ownership provenance
          for cars, trucks, and motorcycles.
        </p>
      </header>

      <section className="w-full max-w-4xl">
        <h2 className="font-cinzel text-2xl text-wine mb-8 text-center">
          VIN Lookup
        </h2>
        <div className="max-w-lg mx-auto space-y-4">
          <input
            type="text"
            placeholder="Enter 17-character VIN..."
            maxLength={17}
            className="w-full rounded-md border border-wine/30 bg-white/50 px-4 py-3 text-center text-lg font-mono tracking-widest placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-wine/30"
          />
          <button className="w-full rounded-md bg-wine px-6 py-3 text-sm font-medium text-white hover:bg-wine/90 transition-colors">
            Search Vehicle History
          </button>
        </div>
      </section>

      <section className="w-full max-w-4xl mt-16">
        <h2 className="font-cinzel text-2xl text-wine mb-8 text-center">
          What We Verify
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { title: "Ownership Chain", desc: "Complete history of every owner" },
            { title: "Title Status", desc: "Clean, salvage, rebuilt, or flood" },
            { title: "Mileage Verification", desc: "Cross-referenced odometer readings" },
            { title: "Accident History", desc: "Reported collisions and damage" },
            { title: "Service Records", desc: "Maintenance and repair history" },
            { title: "VIN Decoding", desc: "Manufacturer specs and recalls" },
          ].map((item) => (
            <div
              key={item.title}
              className="p-6 border border-wine/20 rounded-lg"
            >
              <h3 className="font-medium text-wine mb-2">{item.title}</h3>
              <p className="text-sm text-ink/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-4xl mt-16 text-center">
        <h2 className="font-cinzel text-2xl text-wine mb-4">
          Verify a Certificate
        </h2>
        <p className="text-ink/60 mb-8">
          Enter a Provenance certificate number to verify the authenticity and
          history of a registered vehicle.
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
