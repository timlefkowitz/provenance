import Link from "next/link";

export const metadata = {
  title: 'About | Provenance',
  description: 'Learn about Provenance, a platform helping artists track the provenance of their work with blockchain-verified certificates of authenticity.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col items-center p-8 sm:p-20 font-serif">
      {/* Header */}
      <header className="w-full max-w-4xl flex flex-col items-center mb-12 text-center border-b-4 border-double border-wine pb-8">
        <h1 className="font-display text-5xl sm:text-7xl tracking-widest mb-4 text-wine">
          ABOUT PROVENANCE
        </h1>
        <div className="w-full h-px bg-wine mb-2 opacity-50" />
        <div className="w-full h-px bg-wine mb-4" />
        <p className="font-body italic text-xl sm:text-2xl">
          Empowering Artists Through Immutable Provenance
        </p>
      </header>

      {/* Main Content */}
      <section className="w-full max-w-4xl space-y-12">
        {/* Mission Statement */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            Our Mission
          </h2>
          <div className="space-y-4 font-body text-lg leading-relaxed">
            <p>
              <strong>Provenance</strong> is dedicated to helping artists establish and maintain 
              the complete history of their work. We provide a trusted platform where artists can 
              create certificates of authentication, document ownership transfers, and track the 
              journey of their art from creation through every sale and location.
            </p>
            <p>
              In an art world where authenticity and provenance are paramount, we believe every 
              artist deserves the tools to protect their legacy and ensure their work's history 
              remains accurate, verifiable, and permanent.
            </p>
          </div>
        </div>

        {/* What We Do */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            What We Provide
          </h2>
          <div className="space-y-6 font-body text-lg leading-relaxed">
            <div>
              <h3 className="font-display text-xl mb-2 text-wine">Certificates of Authenticity</h3>
              <p>
                Artists can create official certificates of authentication for their work, 
                establishing a permanent record of the artwork's origin, creator, and initial 
                verification. Each certificate is uniquely numbered and can be verified by 
                collectors, galleries, and institutions.
              </p>
            </div>
            <div>
              <h3 className="font-display text-xl mb-2 text-wine">Provenance Tracking</h3>
              <p>
                Maintain a complete chain of custody for your artwork. Document every sale, 
                transfer, and location change. Know where your art has been sold, who has owned 
                it, and where it currently resides. This comprehensive history adds value and 
                authenticity to your work.
              </p>
            </div>
            <div>
              <h3 className="font-display text-xl mb-2 text-wine">Blockchain Verification</h3>
              <p>
                Coming soon: All certificates and provenance records will be secured on the 
                Avalanche blockchain, ensuring immutability and permanent verification. This 
                blockchain-backed system provides an unalterable record that can be trusted by 
                collectors, auction houses, and museums worldwide.
              </p>
            </div>
          </div>
        </div>

        {/* Why It Matters */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            Why Provenance Matters
          </h2>
          <div className="space-y-4 font-body text-lg leading-relaxed">
            <p>
              Provenance—the documented history of an artwork's ownership and authenticity—is 
              one of the most critical factors in determining an artwork's value and legitimacy. 
              Without proper documentation, even genuine works can be questioned, and artists 
              lose control over their work's narrative.
            </p>
            <p>
              By providing artists with the tools to create and maintain comprehensive provenance 
              records from the moment of creation, we help protect their work's integrity, 
              increase its value, and preserve their artistic legacy for future generations.
            </p>
          </div>
        </div>

        {/* Founders */}
        <div className="border-4 border-double border-wine p-8 md:p-12">
          <h2 className="font-display text-3xl md:text-4xl mb-8 text-wine tracking-wide text-center">
            Our Founders
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Bryson Brooks */}
            <div className="text-center">
              <div className="mb-4">
                <div className="w-32 h-32 mx-auto bg-wine/20 rounded-full flex items-center justify-center border-2 border-wine/30">
                  <span className="text-4xl font-display text-wine">[Photo]</span>
                </div>
              </div>
              <h3 className="font-display text-2xl mb-2 text-wine">Bryson Brooks</h3>
              <p className="font-body italic text-lg mb-3 text-wine/80">Co-Founder & Artist</p>
              <p className="font-body text-base leading-relaxed">
                Bryson Brooks is an internationally recognized artist originally from North Texas 
                and now based in San Antonio. Known as both a painter and performance artist, his 
                unique style blends playful, impressionistic techniques with emotional depth. After 
                earning his Bachelor of Fine Arts from the University of Texas at Austin, Brooks 
                spent time in Mexico City developing his visual and performative work. His notable 
                large-scale landscape paintings "Dawn" and "Dusk," created for Texas A&M 
                University-San Antonio, showcase his bold use of color, lines, and metallic 
                elements to evoke dreamlike, surreal landscapes.
              </p>
            </div>

            {/* Timothy Lefkowitz */}
            <div className="text-center">
              <div className="mb-4">
                <div className="w-32 h-32 mx-auto bg-wine/20 rounded-full flex items-center justify-center border-2 border-wine/30">
                  <span className="text-4xl font-display text-wine">[Photo]</span>
                </div>
              </div>
              <h3 className="font-display text-2xl mb-2 text-wine">Timothy Lefkowitz</h3>
              <p className="font-body italic text-lg mb-3 text-wine/80">Co-Founder & Developer</p>
              <p className="font-body text-base leading-relaxed">
                Timothy Lefkowitz is a multifaceted professional based in San Antonio, combining 
                accomplished software development with creative visual artistry. As a Software 
                Engineer at Accenture Federal Services, he specializes in Java, Akka, Kafka, and 
                Openshift, with expertise in full-stack development and web applications. In 
                addition to his technical background, Lefkowitz is an established photographer 
                and artist, having exhibited his work at numerous venues in San Antonio. His 
                artistic practice, which emphasizes light as a powerful motif, uniquely informs 
                his approach to building technology solutions for artists.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="border-4 border-double border-wine p-8 md:p-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl mb-6 text-wine tracking-wide">
            Get Started
          </h2>
          <p className="font-body text-lg leading-relaxed mb-8">
            Begin documenting your artwork's journey today. Create your first certificate of 
            authenticity and start building the provenance record that will protect and enhance 
            your work's value for years to come.
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

