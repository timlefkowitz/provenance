import Link from "next/link";
import Image from "next/image";
import { getAboutContent } from '../admin/about/_actions/about-content';

export const metadata = {
  title: 'About | Provenance',
  description: 'Learn about Provenance, a platform helping artists track the provenance of their work with blockchain-verified certificates of authenticity.',
};

export default async function AboutPage() {
  const content = await getAboutContent();

  return (
    <main className="min-h-screen flex flex-col items-center p-8 sm:p-20 font-serif">
      {/* Header */}
      <header className="w-full max-w-4xl flex flex-col items-center mb-12 text-center border-b-4 border-double border-wine pb-8">
        <h1 className="font-display text-5xl sm:text-7xl tracking-widest mb-4 text-wine">
          {content.header.title}
        </h1>
        <div className="w-full h-px bg-wine mb-2 opacity-50" />
        <div className="w-full h-px bg-wine mb-4" />
        <p className="font-body italic text-xl sm:text-2xl">
          {content.header.subtitle}
        </p>
      </header>

      {/* Main Content */}
      <section className="w-full max-w-4xl space-y-12">
        {/* Mission Statement */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            {content.mission.title}
          </h2>
          <div className="space-y-4 font-body text-lg leading-relaxed">
            {content.mission.paragraphs.map((para, idx) => (
              <p key={idx} dangerouslySetInnerHTML={{ __html: para }} />
            ))}
          </div>
        </div>

        {/* What We Do */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            {content.whatWeProvide.title}
          </h2>
          <div className="space-y-6 font-body text-lg leading-relaxed">
            {content.whatWeProvide.sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="font-display text-xl mb-2 text-wine">{section.title}</h3>
                <p>{section.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why It Matters */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            {content.whyItMatters.title}
          </h2>
          <div className="space-y-4 font-body text-lg leading-relaxed">
            {content.whyItMatters.paragraphs.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </div>

        {/* Founders */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-8 text-wine tracking-wide text-center">
            {content.founders.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {content.founders.founders.map((founder, idx) => (
              <div key={idx} className="text-center">
                <div className="mb-4">
                  {founder.photo_url ? (
                    <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-wine/30">
                      <Image
                        src={founder.photo_url}
                        alt={founder.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 mx-auto bg-wine/20 rounded-full flex items-center justify-center border-2 border-wine/30">
                      <span className="text-4xl font-display text-wine">[Photo]</span>
                    </div>
                  )}
                </div>
                <h3 className="font-display text-2xl mb-2 text-wine">{founder.name}</h3>
                <p className="font-body italic text-lg mb-3 text-wine/80">{founder.role}</p>
                <p className="font-body text-base leading-relaxed">{founder.bio}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="border-4 border-double border-wine p-8 md:p-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            {content.callToAction.title}
          </h2>
          <p className="font-body text-lg leading-relaxed mb-8">
            {content.callToAction.description}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/artworks/add"
              className="px-8 py-3 bg-wine text-parchment hover:bg-wine/90 transition-colors font-display tracking-wide uppercase text-sm"
            >
              Add Your First Artwork
            </Link>
            <Link 
              href="/artworks"
              className="px-8 py-3 border-2 border-wine text-wine hover:bg-wine/10 transition-colors font-display tracking-wide uppercase text-sm"
            >
              Browse Artworks
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 w-full max-w-4xl text-center text-sm opacity-60 font-body">
        <p>© {new Date().getFullYear()} Provenance Platform. Verified on Avalanche.</p>
      </footer>
    </main>
  );
}

