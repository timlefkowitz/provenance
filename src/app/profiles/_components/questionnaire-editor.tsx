'use client';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import {
  getSuggestedQuestions,
  QUESTIONNAIRE_ANSWER_MAX_LENGTH,
  QUESTIONNAIRE_MAX_ENTRIES,
  QUESTIONNAIRE_QUESTION_MAX_LENGTH,
  type QuestionnaireEntry,
} from '~/lib/profile-questionnaire';
import type { UserRole } from '~/lib/user-roles';

/**
 * Q&A editor for artist / gallery / institution profiles.
 * Suggested questions are one click to add; owners can also write their own.
 * Entries left without an answer are dropped on save.
 */
export function QuestionnaireEditor({
  role,
  entries,
  onChange,
}: {
  role: UserRole;
  entries: QuestionnaireEntry[];
  onChange: (entries: QuestionnaireEntry[]) => void;
}) {
  const asked = new Set(entries.map((e) => e.question.trim().toLowerCase()));
  const suggestions = getSuggestedQuestions(role).filter((q) => !asked.has(q.toLowerCase()));
  const atLimit = entries.length >= QUESTIONNAIRE_MAX_ENTRIES;

  const update = (index: number, patch: Partial<QuestionnaireEntry>) =>
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const add = (question: string) => {
    if (atLimit) return;
    onChange([...entries, { question, answer: '' }]);
  };

  return (
    <div>
      <Label className="font-serif mb-2 block">Questionnaire</Label>
      <p className="text-sm text-ink/60 font-serif mb-3">
        Answer a few questions in your own words. Answers show on your public profile and, if
        you turn on the Q&amp;A section, on your website. Unanswered questions aren&apos;t saved.
      </p>

      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div
            key={index}
            className="p-4 border border-wine/20 rounded-md space-y-3 bg-parchment/40"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm font-serif text-ink/70">Question {index + 1}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move question up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={index === entries.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move question down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 font-serif h-8"
                  onClick={() => onChange(entries.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor={`qa-question-${index}`} className="font-serif text-xs">
                Question
              </Label>
              <Input
                id={`qa-question-${index}`}
                value={entry.question}
                maxLength={QUESTIONNAIRE_QUESTION_MAX_LENGTH}
                onChange={(e) => update(index, { question: e.target.value })}
                className="font-serif mt-1"
                placeholder="Write your own question"
              />
            </div>
            <div>
              <Label htmlFor={`qa-answer-${index}`} className="font-serif text-xs">
                Answer
              </Label>
              <Textarea
                id={`qa-answer-${index}`}
                value={entry.answer}
                maxLength={QUESTIONNAIRE_ANSWER_MAX_LENGTH}
                onChange={(e) => update(index, { answer: e.target.value })}
                className="font-serif mt-1"
                rows={4}
              />
            </div>
          </div>
        ))}

        {!atLimit && suggestions.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-ink/40 font-serif mb-2">
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => add(q)}
                  className="text-left text-sm font-serif px-3 py-1.5 rounded-full border border-wine/25 text-ink/80 hover:bg-wine/10 hover:border-wine/40 transition-colors"
                >
                  <Plus className="inline h-3 w-3 mr-1 -mt-0.5" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-serif border-wine/30 hover:bg-wine/10"
          disabled={atLimit}
          onClick={() => add('')}
        >
          <Plus className="h-4 w-4 mr-2" />
          {atLimit ? `Up to ${QUESTIONNAIRE_MAX_ENTRIES} questions` : 'Add your own question'}
        </Button>
      </div>
    </div>
  );
}
