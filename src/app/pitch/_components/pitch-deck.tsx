'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PitchDeckEditor } from './pitch-deck-editor';
import { updatePitchDeckContent, type PitchDeckSlide } from '../_actions/pitch-deck-content';

type FounderData = {
  bryson: { name: string; role: string; bio: string; photo_url: string };
  timothy: { name: string; role: string; bio: string; photo_url: string };
};

type PitchDeckProps = {
  founderData: FounderData | null;
  initialSlides?: PitchDeckSlide[];
  isAdmin?: boolean;
};

type Slide = PitchDeckSlide;

const SLIDES: Slide[] = [
  {
    id: 1,
    title: 'PROVENANCE',
    subtitle: 'A Journal of Art, Objects & Their Histories',
    tagline: 'The system of record for authentic creative works.',
    type: 'title',
  },
  {
    id: 2,
    title: 'The Problem',
    content: [
      "Artists don't have a way to keep track of their work. Did it sell, did it move galleries. 100% of artists I know in our community have not been able to keep track of the provenance of their work accurately.",
      'The art market runs on trust — but trust is broken.',
      '• Provenance records are fragmented, private, and fragile',
      '• Certificates are paper-based, forgeable, and easy to lose',
      '• Artists enter the market with zero protection',
      '• Collectors & galleries rely on reputation, not verification',
      '',
      'Result:',
      '• $6B+ lost annually to fraud',
      '• Authentic works lose value due to missing history',
    ],
    type: 'problem',
  },
  {
    id: 3,
    title: 'Why Now',
    content: [
      'Why this problem finally gets solved now',
      '',
      '• Artists demand ownership & control from day one',
      '• Digital-native collectors expect verification',
      '• Institutions are open to shared infrastructure',
      '• Blockchain enables immutability without gatekeepers',
      '',
      'This slide answers "Why hasn\'t this existed already?"',
    ],
    type: 'why-now',
  },
  {
    id: 4,
    title: 'The Solution',
    content: [
      'Provenance is the canonical history of an artwork.',
      '',
      'For artists:',
      '• Create certificates at creation',
      '• Keep track of their work',
      '• Give updates to their work',
      '• Control narrative & visibility',
      '• Protect legacy permanently',
      '',
      'For collectors & galleries:',
      '• Instantly verify authenticity',
      '• View full ownership history',
      '• Reduce risk in secondary sales',
      '',
      'Immutable, portable, and artist-first.',
    ],
    type: 'solution',
  },
  {
    id: 5,
    title: 'Product (What Exists Today)',
    content: [
      'Live platform — not a concept',
      '',
      '• Artwork registry & COAs',
      '• Ownership & transfer tracking',
      '• Artist, gallery, collector profiles',
      '• Exhibition management',
      '• Public / private visibility controls',
      '• Discovery via follow system',
    ],
    type: 'product',
  },
  {
    id: 6,
    title: 'The Magic (What\'s Hard to Replicate)',
    content: [
      '• Immutable provenance from creation forward',
      '• Artist-minted certificates',
      '• Structured metadata (not PDFs)',
      '• Chain of custody across owners',
      '• Blockchain anchoring (Avalanche)',
      '• Future-proof storage (IPFS)',
      '',
      'This is your defensibility slide.',
    ],
    type: 'magic',
  },
  {
    id: 7,
    title: 'Market Opportunity',
    content: [
      'A massive market hiding in plain sight',
      '',
      '• Global art market: $65B+',
      '• Digital art & collectibles: $10B+',
      '',
      'Adjacent expansion:',
      '• Design objects',
      '• Rare books',
      '• Coins & memorabilia',
      '• Luxury collectibles',
      '',
      'We start with art. We become provenance infrastructure.',
    ],
    type: 'market',
  },
  {
    id: 9,
    title: 'Traction',
    content: [
      'Early proof this matters',
      '',
      '• Platform launched',
      '• Active artists & galleries onboarded',
      '• X artworks registered',
      '• X certificates issued',
      '• X exhibitions hosted',
      '',
      '⚠️ Even small real numbers beat projections.',
    ],
    type: 'traction',
  },
  {
    id: 10,
    title: 'Competitive Landscape',
    content: [
      'Why existing solutions fall short',
    ],
    table: [
      { solution: 'Solution', artistFirst: 'Artist-first', immutable: 'Immutable', fullLifecycle: 'Full lifecycle' },
      { solution: 'Paper COAs', artistFirst: '❌', immutable: '❌', fullLifecycle: '❌' },
      { solution: 'Gallery databases', artistFirst: '❌', immutable: '❌', fullLifecycle: '❌' },
      { solution: 'NFT platforms', artistFirst: '❌', immutable: '⚠️', fullLifecycle: '❌' },
      { solution: 'Provenance', artistFirst: '✅', immutable: '✅', fullLifecycle: '✅' },
    ],
    footer: 'Clear, calm confidence. No trash talk.',
    type: 'competitive',
  },
  {
    id: 11,
    title: 'Team',
    content: [
      'Unfair advantage: art + engineering',
    ],
    type: 'team',
  },
  {
    id: 12,
    title: 'Roadmap',
    content: [
      'From product to infrastructure',
      '',
      '2025',
      '• Avalanche integration',
      '• IPFS storage',
      '• Mobile apps',
      '• APIs for institutions',
      '',
      '2026',
      '• International expansion',
      '• AI-assisted verification',
      '• Cross-collectible provenance',
    ],
    type: 'roadmap',
  },
  {
    id: 13,
    title: 'Vision',
    content: [
      'The permanent record of human creativity',
      '',
      '• Provenance becomes the default trust layer',
      '• Artists retain authorship forever',
      '• Collectors transact with confidence',
      '• Cultural history is preserved immutably',
      '',
      'This is the slide partners remember.',
    ],
    type: 'vision',
  },
  {
    id: 14,
    title: 'The Ask',
    content: [
      'Raising: $X Seed',
      '',
      'Use of funds:',
      '• Core engineering',
      '• Blockchain & infra',
      '• Artist & gallery acquisition',
      '• Strategic partnerships',
      '',
      'Goal:',
      'Become the system of record before incumbents react.',
    ],
    type: 'ask',
  },
];

export function PitchDeck({ founderData, initialSlides, isAdmin = false }: PitchDeckProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(initialSlides && initialSlides.length > 0 ? initialSlides : SLIDES);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : 0));
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentSlide((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlide(slides.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [slides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const handleSaveSlide = async (updatedSlide: Slide) => {
    if (editingSlideIndex === null) return;
    
    setSaving(true);
    const newSlides = [...slides];
    newSlides[editingSlideIndex] = updatedSlide;
    setSlides(newSlides);
    setEditingSlideIndex(null);

    // Save to server
    try {
      const result = await updatePitchDeckContent({ slides: newSlides });
      if (result.error) {
        alert('Error saving: ' + result.error);
      } else {
        // Refresh the page to get updated content
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving slides:', error);
      alert('Error saving slides');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Provenance Pitch Deck</title>
          <style>
            @page {
              size: letter landscape;
              margin: 0.5in;
            }
            body {
              font-family: serif;
              background: #F5F1E8;
              color: #111111;
              margin: 0;
              padding: 20px;
            }
            .slide {
              page-break-after: always;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding: 40px;
              box-sizing: border-box;
            }
            .slide:last-child {
              page-break-after: auto;
            }
            h1 { font-size: 4rem; margin: 0 0 20px 0; color: #4A2F25; }
            h2 { font-size: 3rem; margin: 0 0 30px 0; color: #4A2F25; }
            .border-box {
              border: 4px double #4A2F25;
              padding: 40px;
              max-width: 90%;
            }
            p { font-size: 1.2rem; line-height: 1.6; margin: 10px 0; }
            .content { max-width: 800px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            table td, table th { padding: 10px; border-bottom: 1px solid #4A2F25; text-align: left; }
            table th { font-weight: bold; border-bottom: 2px solid #4A2F25; }
          </style>
        </head>
        <body>
          ${slides.map((slide, idx) => {
            if (slide.type === 'title') {
              return `
                <div class="slide">
                  <h1>${slide.title}</h1>
                  ${slide.subtitle ? `<p style="font-size: 1.5rem; font-style: italic;">${slide.subtitle}</p>` : ''}
                  ${slide.tagline ? `<p style="font-size: 1.2rem; margin-top: 20px;">${slide.tagline}</p>` : ''}
                </div>
              `;
            }
            if (slide.type === 'team') {
              return `
                <div class="slide">
                  <div class="border-box">
                    <h2>${slide.title}</h2>
                    ${slide.content?.[0] ? `<p style="text-align: center; margin-bottom: 30px;">${slide.content[0]}</p>` : ''}
                    <p style="text-align: center; font-style: italic; margin-top: 30px;">This is a rare founder pairing.</p>
                  </div>
                </div>
              `;
            }
            if (slide.type === 'competitive') {
              return `
                <div class="slide">
                  <div class="border-box">
                    <h2>${slide.title}</h2>
                    ${slide.content?.[0] ? `<p>${slide.content[0]}</p>` : ''}
                    ${slide.table ? `
                      <table>
                        <thead>
                          <tr>
                            <th>Solution</th>
                            <th>Artist-first</th>
                            <th>Immutable</th>
                            <th>Full lifecycle</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${slide.table.slice(1).map(row => `
                            <tr>
                              <td>${row.solution}</td>
                              <td>${row.artistFirst}</td>
                              <td>${row.immutable}</td>
                              <td>${row.fullLifecycle}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    ` : ''}
                    ${slide.footer ? `<p style="font-style: italic; margin-top: 20px;">${slide.footer}</p>` : ''}
                  </div>
                </div>
              `;
            }
            // Convert markdown to simple HTML for PDF export
            const contentHtml = slide.markdown 
              ? slide.markdown
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.+?)\*/g, '<em>$1</em>')
                  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                  .replace(/^\- (.+)$/gm, '<p style="padding-left: 20px;">• $1</p>')
                  .replace(/^\d+\. (.+)$/gm, '<p style="padding-left: 20px;">$1</p>')
                  .split('\n')
                  .filter(line => line.trim())
                  .map(line => line.startsWith('<') ? line : `<p>${line}</p>`)
                  .join('')
              : slide.content?.map(line => {
                  if (line.startsWith('•')) {
                    return `<p style="padding-left: 20px;">${line}</p>`;
                  }
                  if (line.trim() === '') {
                    return '<br/>';
                  }
                  return `<p>${line}</p>`;
                }).join('') || '';
            
            return `
              <div class="slide">
                <div class="border-box">
                  <h2>${slide.title}</h2>
                  <div class="content">
                    ${contentHtml}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const slide = slides[currentSlide];

  return (
    <div className="min-h-screen bg-parchment font-serif relative overflow-hidden">
      {/* Slide Content */}
      <div 
        className="w-full h-screen flex items-center justify-center p-8 sm:p-12 cursor-pointer"
        onClick={nextSlide}
      >
        <div className="w-full max-w-6xl">
          {slide.type === 'title' && (
            <div className="text-center space-y-8">
              <h1 className="font-display text-7xl sm:text-9xl tracking-widest text-wine mb-6">
                {slide.title}
              </h1>
              <div className="w-full h-px bg-wine mb-2 opacity-50" />
              <div className="w-full h-px bg-wine mb-6" />
              <p className="font-body italic text-2xl sm:text-3xl text-wine mb-8">
                {slide.subtitle}
              </p>
              <p className="font-body text-xl sm:text-2xl text-wine/80">
                {slide.tagline}
              </p>
              <div className="mt-12 flex justify-center gap-8">
                {founderData && (
                  <>
                    <div className="text-center">
                      {founderData.bryson.photo_url ? (
                        <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-wine/30 mb-3">
                          <Image
                            src={founderData.bryson.photo_url}
                            alt={founderData.bryson.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 mx-auto bg-wine/20 rounded-full flex items-center justify-center border-2 border-wine/30 mb-3">
                          <span className="text-2xl font-display text-wine">BB</span>
                        </div>
                      )}
                      <p className="font-display text-sm text-wine">{founderData.bryson.name}</p>
                    </div>
                    <div className="text-center">
                      {founderData.timothy.photo_url ? (
                        <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-wine/30 mb-3">
                          <Image
                            src={founderData.timothy.photo_url}
                            alt={founderData.timothy.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 mx-auto bg-wine/20 rounded-full flex items-center justify-center border-2 border-wine/30 mb-3">
                          <span className="text-2xl font-display text-wine">TL</span>
                        </div>
                      )}
                      <p className="font-display text-sm text-wine">{founderData.timothy.name}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {slide.type === 'team' && (
            <div className="space-y-8">
              <h2 className="font-display text-5xl sm:text-6xl text-wine text-center mb-12 tracking-wide">
                {slide.title}
              </h2>
              <div className="space-y-6">
                {slide.content && slide.content[0] && (
                  <p className="font-body text-xl text-center text-wine/80 mb-8">
                    {slide.content[0]}
                  </p>
                )}
                {founderData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="border-4 border-double border-wine p-8 text-center">
                      {founderData.bryson.photo_url ? (
                        <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-wine/30 mb-6">
                          <Image
                            src={founderData.bryson.photo_url}
                            alt={founderData.bryson.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-32 h-32 mx-auto bg-wine/20 rounded-full flex items-center justify-center border-2 border-wine/30 mb-6">
                          <span className="text-4xl font-display text-wine">BB</span>
                        </div>
                      )}
                      <h3 className="font-display text-3xl mb-2 text-wine">{founderData.bryson.name}</h3>
                      <p className="font-body italic text-lg mb-4 text-wine/80">{founderData.bryson.role}</p>
                      <div className="space-y-3 text-left">
                        <p className="font-body text-base leading-relaxed">• Practicing, exhibited artist</p>
                        <p className="font-body text-base leading-relaxed">• Deep understanding of provenance failures</p>
                        <p className="font-body text-base leading-relaxed">• Trusted voice in the art community</p>
                      </div>
                    </div>
                    <div className="border-4 border-double border-wine p-8 text-center">
                      {founderData.timothy.photo_url ? (
                        <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-wine/30 mb-6">
                          <Image
                            src={founderData.timothy.photo_url}
                            alt={founderData.timothy.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-32 h-32 mx-auto bg-wine/20 rounded-full flex items-center justify-center border-2 border-wine/30 mb-6">
                          <span className="text-4xl font-display text-wine">TL</span>
                        </div>
                      )}
                      <h3 className="font-display text-3xl mb-2 text-wine">{founderData.timothy.name}</h3>
                      <p className="font-body italic text-lg mb-4 text-wine/80">{founderData.timothy.role}</p>
                      <div className="space-y-3 text-left">
                        <p className="font-body text-base leading-relaxed">• Full-stack engineer (Accenture Federal Services)</p>
                        <p className="font-body text-base leading-relaxed">• Distributed systems, data integrity</p>
                        <p className="font-body text-base leading-relaxed">• Practicing artist & photographer</p>
                      </div>
                    </div>
                  </div>
                )}
                <p className="font-body text-lg text-center text-wine/70 mt-8 italic">
                  This is a rare founder pairing.
                </p>
              </div>
            </div>
          )}

          {slide.type === 'competitive' && (
            <div className="border-4 border-double border-wine p-8 md:p-12">
              <h2 className="font-display text-4xl sm:text-5xl text-wine mb-8 tracking-wide">
                {slide.title}
              </h2>
              <div className="space-y-4 font-body text-lg sm:text-xl leading-relaxed">
                {slide.content?.map((line, idx) => (
                  <p key={idx} className="text-wine">{line}</p>
                ))}
                {slide.table && (
                  <div className="mt-8 space-y-2">
                    {slide.table.map((row, idx) => (
                      <div
                        key={idx}
                        className={`grid grid-cols-4 gap-4 py-3 ${
                          idx === 0
                            ? 'border-b-2 border-wine font-display font-bold'
                            : idx < slide.table!.length - 1
                            ? 'border-b border-wine/20'
                            : 'border-b-2 border-wine mt-2'
                        }`}
                      >
                        <span className={idx === 0 ? 'text-wine' : 'text-wine/90'}>
                          {row.solution}
                        </span>
                        <span className={`text-center ${idx === 0 ? 'text-wine' : 'text-wine/90'}`}>
                          {row.artistFirst}
                        </span>
                        <span className={`text-center ${idx === 0 ? 'text-wine' : 'text-wine/90'}`}>
                          {row.immutable}
                        </span>
                        <span className={`text-center ${idx === 0 ? 'text-wine' : 'text-wine/90'}`}>
                          {row.fullLifecycle}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {slide.footer && (
                  <p className="text-wine/70 italic mt-6">{slide.footer}</p>
                )}
              </div>
            </div>
          )}

          {slide.type !== 'title' && slide.type !== 'team' && slide.type !== 'competitive' && (
            <div className="border-4 border-double border-wine p-8 md:p-12">
              <h2 className="font-display text-4xl sm:text-5xl text-wine mb-8 tracking-wide">
                {slide.title}
              </h2>
              <div className="space-y-4 font-body text-lg sm:text-xl leading-relaxed text-wine">
                {slide.markdown ? (
                  <div className="prose prose-lg max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="text-wine mb-4">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-6 space-y-2 text-wine/90">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 space-y-2 text-wine/90">{children}</ol>,
                        li: ({ children }) => <li className="text-wine/90">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-wine">{children}</strong>,
                        em: ({ children }) => <em className="italic text-wine">{children}</em>,
                        h1: ({ children }) => <h1 className="font-display text-3xl text-wine mb-4">{children}</h1>,
                        h2: ({ children }) => <h2 className="font-display text-2xl text-wine mb-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="font-display text-xl text-wine mb-2">{children}</h3>,
                      }}
                    >
                      {slide.markdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  slide.content?.map((line, idx) => {
                    if (line.startsWith('•')) {
                      return (
                        <p key={idx} className="text-wine/90 pl-4">
                          {line}
                        </p>
                      );
                    } else if (line.trim() === '') {
                      return <br key={idx} />;
                    } else {
                      return (
                        <p key={idx} className={line.includes('⚠️') ? 'text-wine italic' : 'text-wine'}>
                          {line}
                        </p>
                      );
                    }
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          disabled={currentSlide === 0}
          className="px-4 py-2 bg-wine/80 text-parchment hover:bg-wine disabled:opacity-50 disabled:cursor-not-allowed font-display tracking-wide uppercase text-sm transition-colors"
        >
          ← Prev
        </button>
        <div className="flex gap-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(idx);
              }}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentSlide ? 'bg-wine' : 'bg-wine/30'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          disabled={currentSlide === slides.length - 1}
          className="px-4 py-2 bg-wine/80 text-parchment hover:bg-wine disabled:opacity-50 disabled:cursor-not-allowed font-display tracking-wide uppercase text-sm transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Slide Counter */}
      <div className="fixed top-8 right-8 text-wine/60 font-body text-sm">
        {currentSlide + 1} / {slides.length}
      </div>

      {/* Instructions */}
      <div className="fixed top-8 left-8 text-wine/40 font-body text-xs">
        Click or use arrow keys to navigate
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 flex gap-4 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditMode(!isEditMode);
            }}
            className="px-4 py-2 bg-wine/80 text-parchment hover:bg-wine font-display tracking-wide uppercase text-sm transition-colors"
          >
            {isEditMode ? 'Exit Edit' : 'Edit Mode'}
          </button>
          {isEditMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingSlideIndex(currentSlide);
              }}
              className="px-4 py-2 bg-wine/80 text-parchment hover:bg-wine font-display tracking-wide uppercase text-sm transition-colors"
            >
              Edit Slide
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExportPDF();
            }}
            className="px-4 py-2 bg-wine/80 text-parchment hover:bg-wine font-display tracking-wide uppercase text-sm transition-colors"
          >
            Export PDF
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {editingSlideIndex !== null && (
        <PitchDeckEditor
          slide={slides[editingSlideIndex]}
          onSave={handleSaveSlide}
          onCancel={() => setEditingSlideIndex(null)}
        />
      )}

      {saving && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-parchment border-4 border-double border-wine p-8">
            <p className="font-display text-wine text-xl">Saving...</p>
          </div>
        </div>
      )}
    </div>
  );
}

