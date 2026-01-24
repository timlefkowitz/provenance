'use client';

import { useState, useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { updatePitchDeckContent, type PitchDeckContent, type PitchDeckSlide } from '~/app/pitch/_actions/pitch-deck-content';
import { useRouter } from 'next/navigation';
import { MarkdownEditor } from '~/app/pitch/_components/markdown-editor';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

export function EditPitchDeckForm({ initialContent }: { initialContent: PitchDeckContent }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slides, setSlides] = useState<PitchDeckSlide[]>(initialContent.slides);
  const [expandedSlides, setExpandedSlides] = useState<Set<number>>(new Set([0])); // First slide expanded by default

  const toggleSlide = (slideId: number) => {
    const newExpanded = new Set(expandedSlides);
    if (newExpanded.has(slideId)) {
      newExpanded.delete(slideId);
    } else {
      newExpanded.add(slideId);
    }
    setExpandedSlides(newExpanded);
  };

  const updateSlide = (index: number, updates: Partial<PitchDeckSlide>) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    setSlides(newSlides);
  };

  const addSlide = () => {
    const newSlide: PitchDeckSlide = {
      id: Math.max(...slides.map(s => s.id), 0) + 1,
      title: 'New Slide',
      type: 'content',
      markdown: '',
    };
    setSlides([...slides, newSlide]);
    setExpandedSlides(new Set([...expandedSlides, newSlide.id]));
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) {
      toast.error('Cannot remove the last slide');
      return;
    }
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === slides.length - 1) return;

    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    setSlides(newSlides);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      const result = await updatePitchDeckContent({ slides });
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Pitch deck updated successfully');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="border-2 border-wine/30 bg-parchment rounded-lg overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-4 bg-wine/10 cursor-pointer hover:bg-wine/20 transition-colors"
              onClick={() => toggleSlide(slide.id)}
            >
              <div className="flex items-center gap-4 flex-1">
                <span className="font-display text-wine font-bold">#{index + 1}</span>
                <h3 className="font-display text-xl text-wine">{slide.title || 'Untitled Slide'}</h3>
                <span className="text-sm text-wine/70 font-serif">({slide.type})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSlide(index, 'up');
                  }}
                  disabled={index === 0}
                  className="p-1 text-wine hover:bg-wine/20 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSlide(index, 'down');
                  }}
                  disabled={index === slides.length - 1}
                  className="p-1 text-wine hover:bg-wine/20 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {expandedSlides.has(slide.id) ? (
                  <ChevronUp className="w-5 h-5 text-wine" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-wine" />
                )}
              </div>
            </div>

            {expandedSlides.has(slide.id) && (
              <div className="p-6 space-y-4">
                <div>
                  <Label className="font-display text-wine mb-2">Title</Label>
                  <Input
                    value={slide.title}
                    onChange={(e) => updateSlide(index, { title: e.target.value })}
                    className="border-2 border-wine/30 bg-parchment text-wine"
                  />
                </div>

                {slide.subtitle !== undefined && (
                  <div>
                    <Label className="font-display text-wine mb-2">Subtitle</Label>
                    <Input
                      value={slide.subtitle || ''}
                      onChange={(e) => updateSlide(index, { subtitle: e.target.value })}
                      className="border-2 border-wine/30 bg-parchment text-wine"
                    />
                  </div>
                )}

                {slide.tagline !== undefined && (
                  <div>
                    <Label className="font-display text-wine mb-2">Tagline</Label>
                    <Input
                      value={slide.tagline || ''}
                      onChange={(e) => updateSlide(index, { tagline: e.target.value })}
                      className="border-2 border-wine/30 bg-parchment text-wine"
                    />
                  </div>
                )}

                <div>
                  <Label className="font-display text-wine mb-2">Type</Label>
                  <select
                    value={slide.type}
                    onChange={(e) => updateSlide(index, { type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-wine/30 bg-parchment text-wine rounded"
                  >
                    <option value="title">Title</option>
                    <option value="problem">Problem</option>
                    <option value="why-now">Why Now</option>
                    <option value="solution">Solution</option>
                    <option value="product">Product</option>
                    <option value="magic">Magic</option>
                    <option value="market">Market</option>
                    <option value="traction">Traction</option>
                    <option value="competitive">Competitive</option>
                    <option value="team">Team</option>
                    <option value="roadmap">Roadmap</option>
                    <option value="vision">Vision</option>
                    <option value="ask">Ask</option>
                    <option value="content">Content</option>
                  </select>
                </div>

                {slide.type !== 'title' && slide.type !== 'team' && (
                  <MarkdownEditor
                    value={slide.markdown || (slide.content ? slide.content.join('\n') : '')}
                    onChange={(value) => updateSlide(index, { markdown: value, content: undefined })}
                    label="Content (Markdown)"
                    placeholder="Enter markdown content for this slide..."
                  />
                )}

                {slide.footer !== undefined && (
                  <div>
                    <Label className="font-display text-wine mb-2">Footer</Label>
                    <Input
                      value={slide.footer || ''}
                      onChange={(e) => updateSlide(index, { footer: e.target.value })}
                      className="border-2 border-wine/30 bg-parchment text-wine"
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeSlide(index)}
                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Slide
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={addSlide}
          className="px-6 py-3 bg-wine/80 text-parchment hover:bg-wine font-display tracking-wide uppercase flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Slide
        </button>
        <Button
          type="submit"
          disabled={pending}
          className="flex-1 bg-wine text-parchment hover:bg-wine/90 font-display tracking-wide uppercase"
        >
          {pending ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </form>
  );
}

