import { describe, expect, it } from 'vitest';
import {
  getSuggestedQuestions,
  sanitizeQuestionnaire,
  supportsQuestionnaire,
  QUESTIONNAIRE_ANSWER_MAX_LENGTH,
  QUESTIONNAIRE_MAX_ENTRIES,
} from './profile-questionnaire';

describe('sanitizeQuestionnaire', () => {
  it('returns [] for non-arrays', () => {
    expect(sanitizeQuestionnaire(null)).toEqual([]);
    expect(sanitizeQuestionnaire({ question: 'a', answer: 'b' })).toEqual([]);
  });

  it('trims and drops entries missing a question or answer', () => {
    expect(
      sanitizeQuestionnaire([
        { question: '  Why paint?  ', answer: '  Because.  ' },
        { question: 'Unanswered', answer: '   ' },
        { question: '', answer: 'Orphan answer' },
        { question: 42, answer: 'not a string' },
        'junk',
      ]),
    ).toEqual([{ question: 'Why paint?', answer: 'Because.' }]);
  });

  it('dedupes questions case-insensitively, keeping the first', () => {
    expect(
      sanitizeQuestionnaire([
        { question: 'Why paint?', answer: 'First' },
        { question: 'why PAINT?', answer: 'Second' },
      ]),
    ).toEqual([{ question: 'Why paint?', answer: 'First' }]);
  });

  it('caps answer length and entry count', () => {
    const long = 'x'.repeat(QUESTIONNAIRE_ANSWER_MAX_LENGTH + 50);
    const many = Array.from({ length: QUESTIONNAIRE_MAX_ENTRIES + 5 }, (_, i) => ({
      question: `Q${i}`,
      answer: i === 0 ? long : 'a',
    }));
    const out = sanitizeQuestionnaire(many);
    expect(out).toHaveLength(QUESTIONNAIRE_MAX_ENTRIES);
    expect(out[0]!.answer).toHaveLength(QUESTIONNAIRE_ANSWER_MAX_LENGTH);
  });
});

describe('getSuggestedQuestions', () => {
  it('offers questions for artists, galleries and institutions only', () => {
    expect(getSuggestedQuestions('artist').length).toBeGreaterThan(0);
    expect(getSuggestedQuestions('gallery').length).toBeGreaterThan(0);
    expect(getSuggestedQuestions('institution').length).toBeGreaterThan(0);
    expect(supportsQuestionnaire('collector')).toBe(false);
    expect(supportsQuestionnaire(null)).toBe(false);
  });
});

describe('withAllSectionKeys', async () => {
  const { withAllSectionKeys, DEFAULT_SECTION_ORDER } = await import('~/app/_sites/types');

  it('uses the default order when nothing is saved', () => {
    expect(withAllSectionKeys(null)).toEqual(DEFAULT_SECTION_ORDER);
  });

  it('slots a newly added section after its default predecessor', () => {
    expect(withAllSectionKeys(['artworks', 'press', 'bio', 'exhibitions', 'contact'])).toEqual([
      'artworks',
      'press',
      'questionnaire',
      'bio',
      'exhibitions',
      'contact',
    ]);
  });
});
