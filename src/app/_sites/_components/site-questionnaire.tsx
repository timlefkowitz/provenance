'use client';

/**
 * Site Q&A section — the owner's profile questionnaire on their website.
 *
 * renderSiteTemplate provides the entries via context so OrderedSections can
 * render this shared section for every template without each one wiring a slot.
 * It inherits the template's font and ink color; only the heading and
 * questions pick up the accent.
 */

import { createContext, useContext } from 'react';
import { ProfileQuestionnaire } from '~/components/profile-questionnaire';
import type { QuestionnaireEntry } from '~/lib/profile-questionnaire';

const SiteQuestionnaireContext = createContext<QuestionnaireEntry[]>([]);

export function SiteQuestionnaireProvider({
  entries,
  children,
}: {
  entries: QuestionnaireEntry[];
  children: React.ReactNode;
}) {
  return (
    <SiteQuestionnaireContext.Provider value={entries}>{children}</SiteQuestionnaireContext.Provider>
  );
}

export function useSiteQuestionnaire(): QuestionnaireEntry[] {
  return useContext(SiteQuestionnaireContext);
}

export function SiteQuestionnaireSection({ accentColor }: { accentColor?: string }) {
  const entries = useSiteQuestionnaire();
  if (entries.length === 0) return null;

  return (
    <section id="questionnaire" className="py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-6">
        <p className="text-xs uppercase tracking-[0.2em] mb-10" style={{ color: accentColor }}>
          Q&amp;A
        </p>
        <ProfileQuestionnaire
          entries={entries}
          className="space-y-10"
          questionClassName="text-lg md:text-xl font-medium"
          answerClassName="text-sm md:text-base opacity-75"
          accentColor={accentColor}
        />
      </div>
    </section>
  );
}
