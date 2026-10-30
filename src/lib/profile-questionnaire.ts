/**
 * Helpers for the profile questionnaire (user_profiles.questionnaire):
 * a public Q&A the profile owner answers, shown on their profile and website.
 */

import { USER_ROLES, type UserRole } from '~/lib/user-roles';

export type QuestionnaireEntry = {
  question: string;
  answer: string;
};

export const QUESTIONNAIRE_MAX_ENTRIES = 20;
export const QUESTIONNAIRE_QUESTION_MAX_LENGTH = 200;
export const QUESTIONNAIRE_ANSWER_MAX_LENGTH = 2000;

const ARTIST_QUESTIONS = [
  'What drew you to your medium?',
  'Describe a typical day in your studio.',
  'Which artists have influenced you most?',
  'What themes keep returning in your work?',
  'How do you know when a piece is finished?',
  'What are you working on right now?',
  'What advice would you give an emerging artist?',
  'What should collectors know about your work?',
];

const GALLERY_QUESTIONS = [
  'How did the gallery get started?',
  'What is your programming focus?',
  'How do you find and select artists?',
  'What makes your space different?',
  'What should first-time collectors know?',
  'Which exhibition are you proudest of?',
  'What is coming up next season?',
];

const INSTITUTION_QUESTIONS = [
  'What is your mission?',
  'What does your collection focus on?',
  'How do you approach acquisitions?',
  'How can artists and researchers work with you?',
  'What community programs do you run?',
  'What is the story behind your institution?',
  'What is on view right now?',
];

/** Suggested questions for roles that can answer a questionnaire. Empty for other roles. */
export function getSuggestedQuestions(role: UserRole | string | null | undefined): string[] {
  if (role === USER_ROLES.ARTIST) return ARTIST_QUESTIONS;
  if (role === USER_ROLES.GALLERY) return GALLERY_QUESTIONS;
  if (role === USER_ROLES.INSTITUTION) return INSTITUTION_QUESTIONS;
  return [];
}

export function supportsQuestionnaire(role: UserRole | string | null | undefined): boolean {
  return getSuggestedQuestions(role).length > 0;
}

/**
 * Normalize untrusted input or a stored jsonb value: trims, drops entries
 * without both a question and an answer, dedupes questions, caps lengths and count.
 */
export function sanitizeQuestionnaire(raw: unknown): QuestionnaireEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: QuestionnaireEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { question, answer } = item as Record<string, unknown>;
    if (typeof question !== 'string' || typeof answer !== 'string') continue;
    const q = question.trim().slice(0, QUESTIONNAIRE_QUESTION_MAX_LENGTH);
    const a = answer.trim().slice(0, QUESTIONNAIRE_ANSWER_MAX_LENGTH);
    if (!q || !a) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ question: q, answer: a });
    if (out.length >= QUESTIONNAIRE_MAX_ENTRIES) break;
  }
  return out;
}
