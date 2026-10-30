import type { CSSProperties } from 'react';
import type { QuestionnaireEntry } from '~/lib/profile-questionnaire';

/**
 * Presentational Q&A list for a profile questionnaire.
 * Inherits font and color from its container so it fits the platform profile,
 * the artist profile templates and the creator-site templates alike; callers
 * tune the question/answer look via class names and an optional accent color.
 */
export function ProfileQuestionnaire({
  entries,
  className,
  questionClassName = 'font-semibold',
  answerClassName = 'opacity-80',
  accentColor,
}: {
  entries: QuestionnaireEntry[];
  className?: string;
  questionClassName?: string;
  answerClassName?: string;
  /** Applied to the question text (e.g. a site's accent). */
  accentColor?: string;
}) {
  if (entries.length === 0) return null;
  const questionStyle: CSSProperties | undefined = accentColor ? { color: accentColor } : undefined;

  return (
    <dl className={className ?? 'space-y-6'}>
      {entries.map((entry, i) => (
        <div key={`${entry.question}-${i}`} className="break-inside-avoid">
          <dt className={questionClassName} style={questionStyle}>
            {entry.question}
          </dt>
          <dd className={`mt-1.5 whitespace-pre-wrap leading-relaxed ${answerClassName}`}>
            {entry.answer}
          </dd>
        </div>
      ))}
    </dl>
  );
}
