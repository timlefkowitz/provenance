import OpenAI from 'openai';
import { z } from 'zod';

import { logger } from '~/lib/logger';

import type { ValuationInputs } from './compute-valuation-inputs';

const LLM_MODEL = 'gpt-4o-mini';

const LlmValuationSchema = z.object({
  estimated_value_cents: z.number().int().nonnegative().optional().nullable(),
  confidence_low_cents: z.number().int().nonnegative().optional().nullable(),
  confidence_high_cents: z.number().int().nonnegative().optional().nullable(),
  cultural_importance_score: z.number().min(0).max(100).optional().nullable(),
  liquidity_score: z.number().min(0).max(100).optional().nullable(),
  forgery_risk_score: z.number().min(0).max(100).optional().nullable(),
  narrative: z.string().max(4000).optional().nullable(),
});

export type LlmValuationOutput = z.infer<typeof LlmValuationSchema>;

export interface LlmValuationResult {
  model: string | null;
  output: Required<{
    estimated_value_cents: number;
    confidence_low_cents: number;
    confidence_high_cents: number;
    cultural_importance_score: number;
    liquidity_score: number;
    forgery_risk_score: number;
    narrative: string;
  }>;
  error: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyFallback(inputs: ValuationInputs): LlmValuationResult['output'] {
  return {
    estimated_value_cents: inputs.deterministic_output.estimated_value_cents,
    confidence_low_cents: inputs.deterministic_output.confidence_low_cents,
    confidence_high_cents: inputs.deterministic_output.confidence_high_cents,
    cultural_importance_score: inputs.deterministic_output.cultural_importance_score,
    liquidity_score: inputs.deterministic_output.liquidity_score,
    forgery_risk_score: inputs.deterministic_output.forgery_risk_score,
    narrative:
      'This valuation was produced from the deterministic Provenance engine using ownership history, exhibition record, and comparable sales. No LLM reasoning pass was applied.',
  };
}

/**
 * Run the optional LLM reasoning pass on top of deterministic inputs.
 * Failures fall back to the deterministic output + neutral narrative; this
 * function never throws.
 */
export async function runLlmValuationPass(
  inputs: ValuationInputs,
): Promise<LlmValuationResult> {
  const rawKey = process.env.OPENAI_API_KEY;
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : undefined;

  if (!apiKey) {
    console.log('[Valuation] runLlmValuationPass skipped — OPENAI_API_KEY not set');
    return {
      model: null,
      output: applyFallback(inputs),
      error: 'OpenAI API key not configured',
    };
  }

  try {
    console.log('[Valuation] runLlmValuationPass calling OpenAI', {
      artworkId: inputs.artwork_id,
    });
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert art-market analyst embedded in the Provenance valuation engine. You receive structured inputs about one artwork: medium, condition, provenance chain, auction comparables, museum presence, exhibitions, and artist market cap. Produce a cautious, defensible valuation. Return ONLY a JSON object with keys: estimated_value_cents (integer, USD cents), confidence_low_cents (integer), confidence_high_cents (integer), cultural_importance_score (0-100), liquidity_score (0-100), forgery_risk_score (0-100), narrative (short paragraph explaining the reasoning). Never invent comparables that are not in the input. If the data is too thin, widen the confidence range.',
        },
        {
          role: 'user',
          content: JSON.stringify(inputs).slice(0, 12000),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return {
        model: LLM_MODEL,
        output: applyFallback(inputs),
        error: 'Empty response from OpenAI',
      };
    }

    const parsed = LlmValuationSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error('[Valuation] runLlmValuationPass zod parse failed', parsed.error);
      return {
        model: LLM_MODEL,
        output: applyFallback(inputs),
        error: 'LLM response failed validation',
      };
    }

    const fallback = applyFallback(inputs);
    const out: LlmValuationResult['output'] = {
      estimated_value_cents:
        parsed.data.estimated_value_cents != null
          ? Math.max(0, Math.round(parsed.data.estimated_value_cents))
          : fallback.estimated_value_cents,
      confidence_low_cents:
        parsed.data.confidence_low_cents != null
          ? Math.max(0, Math.round(parsed.data.confidence_low_cents))
          : fallback.confidence_low_cents,
      confidence_high_cents:
        parsed.data.confidence_high_cents != null
          ? Math.max(0, Math.round(parsed.data.confidence_high_cents))
          : fallback.confidence_high_cents,
      cultural_importance_score:
        parsed.data.cultural_importance_score != null
          ? clamp(parsed.data.cultural_importance_score, 0, 100)
          : fallback.cultural_importance_score,
      liquidity_score:
        parsed.data.liquidity_score != null
          ? clamp(parsed.data.liquidity_score, 0, 100)
          : fallback.liquidity_score,
      forgery_risk_score:
        parsed.data.forgery_risk_score != null
          ? clamp(parsed.data.forgery_risk_score, 0, 100)
          : fallback.forgery_risk_score,
      narrative:
        (parsed.data.narrative && parsed.data.narrative.trim()) || fallback.narrative,
    };

    if (out.confidence_low_cents > out.estimated_value_cents) {
      out.confidence_low_cents = out.estimated_value_cents;
    }
    if (out.confidence_high_cents < out.estimated_value_cents) {
      out.confidence_high_cents = out.estimated_value_cents;
    }

    console.log('[Valuation] runLlmValuationPass complete', {
      artworkId: inputs.artwork_id,
    });

    return { model: LLM_MODEL, output: out, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LLM pass failed';
    console.error('[Valuation] runLlmValuationPass failed', err);
    logger.error('llm_valuation_pass_failed', { artworkId: inputs.artwork_id, error: err });
    return {
      model: null,
      output: applyFallback(inputs),
      error: message,
    };
  }
}
