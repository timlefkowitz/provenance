'use client';

import { useState, useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { updateAboutContent, type AboutContent } from '../_actions/about-content';
import { useRouter } from 'next/navigation';

export function EditAboutForm({ initialContent }: { initialContent: AboutContent }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState<AboutContent>(initialContent);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      const result = await updateAboutContent(content);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('About page updated successfully');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Section */}
      <div className="border-4 border-double border-wine p-6 space-y-4">
        <h2 className="font-display text-2xl text-wine">Header</h2>
        <div>
          <Label htmlFor="header-title">Title</Label>
          <Input
            id="header-title"
            value={content.header.title}
            onChange={(e) => setContent({
              ...content,
              header: { ...content.header, title: e.target.value }
            })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="header-subtitle">Subtitle</Label>
          <Input
            id="header-subtitle"
            value={content.header.subtitle}
            onChange={(e) => setContent({
              ...content,
              header: { ...content.header, subtitle: e.target.value }
            })}
            className="mt-1"
          />
        </div>
      </div>

      {/* Mission Section */}
      <div className="border-4 border-double border-wine p-6 space-y-4">
        <h2 className="font-display text-2xl text-wine">Mission</h2>
        <div>
          <Label htmlFor="mission-title">Title</Label>
          <Input
            id="mission-title"
            value={content.mission.title}
            onChange={(e) => setContent({
              ...content,
              mission: { ...content.mission, title: e.target.value }
            })}
            className="mt-1"
          />
        </div>
        {content.mission.paragraphs.map((para, idx) => (
          <div key={idx}>
            <Label htmlFor={`mission-para-${idx}`}>Paragraph {idx + 1}</Label>
            <Textarea
              id={`mission-para-${idx}`}
              value={para}
              onChange={(e) => {
                const newParagraphs = [...content.mission.paragraphs];
                newParagraphs[idx] = e.target.value;
                setContent({
                  ...content,
                  mission: { ...content.mission, paragraphs: newParagraphs }
                });
              }}
              className="mt-1 min-h-[100px]"
            />
          </div>
        ))}
      </div>

      {/* What We Provide Section */}
      <div className="border-4 border-double border-wine p-6 space-y-4">
        <h2 className="font-display text-2xl text-wine">What We Provide</h2>
        <div>
          <Label htmlFor="what-title">Title</Label>
          <Input
            id="what-title"
            value={content.whatWeProvide.title}
            onChange={(e) => setContent({
              ...content,
              whatWeProvide: { ...content.whatWeProvide, title: e.target.value }
            })}
            className="mt-1"
          />
        </div>
        {content.whatWeProvide.sections.map((section, idx) => (
          <div key={idx} className="border border-wine/30 p-4 space-y-2">
            <div>
              <Label htmlFor={`what-section-title-${idx}`}>Section {idx + 1} Title</Label>
              <Input
                id={`what-section-title-${idx}`}
                value={section.title}
                onChange={(e) => {
                  const newSections = [...content.whatWeProvide.sections];
                  newSections[idx] = { ...newSections[idx], title: e.target.value };
                  setContent({
                    ...content,
                    whatWeProvide: { ...content.whatWeProvide, sections: newSections }
                  });
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`what-section-content-${idx}`}>Section {idx + 1} Content</Label>
              <Textarea
                id={`what-section-content-${idx}`}
                value={section.content}
                onChange={(e) => {
                  const newSections = [...content.whatWeProvide.sections];
                  newSections[idx] = { ...newSections[idx], content: e.target.value };
                  setContent({
                    ...content,
                    whatWeProvide: { ...content.whatWeProvide, sections: newSections }
                  });
                }}
                className="mt-1 min-h-[100px]"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Why It Matters Section */}
      <div className="border-4 border-double border-wine p-6 space-y-4">
        <h2 className="font-display text-2xl text-wine">Why It Matters</h2>
        <div>
          <Label htmlFor="why-title">Title</Label>
          <Input
            id="why-title"
            value={content.whyItMatters.title}
            onChange={(e) => setContent({
              ...content,
              whyItMatters: { ...content.whyItMatters, title: e.target.value }
            })}
            className="mt-1"
          />
        </div>
        {content.whyItMatters.paragraphs.map((para, idx) => (
          <div key={idx}>
            <Label htmlFor={`why-para-${idx}`}>Paragraph {idx + 1}</Label>
            <Textarea
              id={`why-para-${idx}`}
              value={para}
              onChange={(e) => {
                const newParagraphs = [...content.whyItMatters.paragraphs];
                newParagraphs[idx] = e.target.value;
                setContent({
                  ...content,
                  whyItMatters: { ...content.whyItMatters, paragraphs: newParagraphs }
                });
              }}
              className="mt-1 min-h-[100px]"
            />
          </div>
        ))}
      </div>

      {/* Founders Section */}
      <div className="border-4 border-double border-wine p-6 space-y-4">
        <h2 className="font-display text-2xl text-wine">Founders</h2>
        <div>
          <Label htmlFor="founders-title">Title</Label>
          <Input
            id="founders-title"
            value={content.founders.title}
            onChange={(e) => setContent({
              ...content,
              founders: { ...content.founders, title: e.target.value }
            })}
            className="mt-1"
          />
        </div>
        {content.founders.founders.map((founder, idx) => (
          <div key={idx} className="border border-wine/30 p-4 space-y-2">
            <div>
              <Label htmlFor={`founder-name-${idx}`}>Founder {idx + 1} Name</Label>
              <Input
                id={`founder-name-${idx}`}
                value={founder.name}
                onChange={(e) => {
                  const newFounders = [...content.founders.founders];
                  newFounders[idx] = { ...newFounders[idx], name: e.target.value };
                  setContent({
                    ...content,
                    founders: { ...content.founders, founders: newFounders }
                  });
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`founder-role-${idx}`}>Founder {idx + 1} Role</Label>
              <Input
                id={`founder-role-${idx}`}
                value={founder.role}
                onChange={(e) => {
                  const newFounders = [...content.founders.founders];
                  newFounders[idx] = { ...newFounders[idx], role: e.target.value };
                  setContent({
                    ...content,
                    founders: { ...content.founders, founders: newFounders }
                  });
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`founder-bio-${idx}`}>Founder {idx + 1} Bio</Label>
              <Textarea
                id={`founder-bio-${idx}`}
                value={founder.bio}
                onChange={(e) => {
                  const newFounders = [...content.founders.founders];
                  newFounders[idx] = { ...newFounders[idx], bio: e.target.value };
                  setContent({
                    ...content,
                    founders: { ...content.founders, founders: newFounders }
                  });
                }}
                className="mt-1 min-h-[150px]"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Call to Action Section */}
      <div className="border-4 border-double border-wine p-6 space-y-4">
        <h2 className="font-display text-2xl text-wine">Call to Action</h2>
        <div>
          <Label htmlFor="cta-title">Title</Label>
          <Input
            id="cta-title"
            value={content.callToAction.title}
            onChange={(e) => setContent({
              ...content,
              callToAction: { ...content.callToAction, title: e.target.value }
            })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="cta-description">Description</Label>
          <Textarea
            id="cta-description"
            value={content.callToAction.description}
            onChange={(e) => setContent({
              ...content,
              callToAction: { ...content.callToAction, description: e.target.value }
            })}
            className="mt-1 min-h-[100px]"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="bg-wine text-parchment hover:bg-wine/90"
        >
          {pending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

