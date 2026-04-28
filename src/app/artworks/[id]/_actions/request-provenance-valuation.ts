'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import {
  computeValuationInputs,
  VALUATION_ENGINE_VERSION,
} from '~/lib/valuation/compute-valuation-inputs';
import { runLlmValuationPass } from '~/lib/valuation/llm-valuation-pass';
import { logger } from '~/lib/logger';

const RATE_LIMIT_MS = 5 * 60 * 1000;

export interface RequestValuationResult {
  success: boolean;
  error?: string;
  valuationId?: string;
  llmUsed?: boolean;
}

export async function requestProvenanceValuation(
  artworkId: string,
  options?: { makePublic?: boolean },
): Promise<RequestValuationResult> {
  console.log('[Valuation] requestProvenanceValuation started', { artworkId });

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to request a valuation' };
    }

    const { data: artwork, error: fetchError } = await (client as any)
      .from('artworks')
      .select('id, account_id, gallery_profile_id')
      .eq('id', artworkId)
      .single();

    if (fetchError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    const canEdit = await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    });
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to request a valuation' };
    }

    const admin = getSupabaseServerAdminClient();

    const { data: existing } = await (admin as any)
      .from('artwork_valuations')
      .select('generated_at')
      .eq('artwork_id', artworkId)
      .order('generated_at', { ascending: false })
      .limit(1);

    const lastGeneratedAt =
      Array.isArray(existing) && existing.length > 0
        ? new Date(existing[0].generated_at as string).getTime()
        : 0;

    if (lastGeneratedAt && Date.now() - lastGeneratedAt < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil(
        (RATE_LIMIT_MS - (Date.now() - lastGeneratedAt)) / 1000,
      );
      return {
        success: false,
        error: `A valuation was just generated. Try again in ${waitSeconds}s.`,
      };
    }

    const valuationResult = await computeValuationInputs(artworkId);
    if (!valuationResult.ok) {
      return { success: false, error: valuationResult.reason };
    }
    const { inputs } = valuationResult;

    const llmResult = await runLlmValuationPass(inputs);

    const { data: inserted, error: insertError } = await (admin as any)
      .from('artwork_valuations')
      .insert({
        artwork_id: artworkId,
        generated_by: user.id,
        engine_version: VALUATION_ENGINE_VERSION,
        llm_model: llmResult.model,

        medium: inputs.medium,
        condition: inputs.condition,
        rarity_index: inputs.rarity_index,
        former_owners_count: inputs.former_owners_count,
        notable_collectors_count: inputs.notable_collectors_count,
        museum_count: inputs.museum_count,
        artist_market_cap_cents: inputs.artist_market_cap_cents,
        auction_history_summary: inputs.auction_history_summary,
        museum_presence_count: inputs.museum_presence_count,
        exhibition_count: inputs.exhibition_count,
        scholarly_citations_count: inputs.scholarly_citations_count,
        market_signals: inputs.market_signals,

        estimated_value_cents: llmResult.output.estimated_value_cents,
        confidence_low_cents: llmResult.output.confidence_low_cents,
        confidence_high_cents: llmResult.output.confidence_high_cents,
        cultural_importance_score: llmResult.output.cultural_importance_score,
        liquidity_score: llmResult.output.liquidity_score,
        forgery_risk_score: llmResult.output.forgery_risk_score,
        narrative: llmResult.output.narrative,
        is_public: !!options?.makePublic,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Valuation] requestProvenanceValuation insert failed', insertError);
      logger.error('request_valuation_insert_failed', { artworkId, error: insertError });
      return { success: false, error: insertError.message || 'Failed to save valuation' };
    }

    revalidatePath(`/artworks/${artworkId}`);
    revalidatePath(`/artworks/${artworkId}/certificate`);

    console.log('[Valuation] requestProvenanceValuation completed', {
      artworkId,
      valuationId: inserted?.id,
      llmUsed: !!llmResult.model,
    });

    return {
      success: true,
      valuationId: inserted?.id as string | undefined,
      llmUsed: !!llmResult.model,
    };
  } catch (err) {
    console.error('[Valuation] requestProvenanceValuation failed', err);
    logger.error('request_valuation_failed', { artworkId, error: err });
    return { success: false, error: (err as Error).message || 'Failed to request valuation' };
  }
}

/**
 * Toggle the public visibility of an existing valuation (used by the "Make
 * valuation public" switch in the breakdown drawer).
 */
export async function setValuationPublic(
  valuationId: string,
  makePublic: boolean,
): Promise<{ success: boolean; error?: string }> {
  console.log('[Valuation] setValuationPublic', { valuationId, makePublic });
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, error: 'Not signed in' };

    const admin = getSupabaseServerAdminClient();
    const { data: valuation, error: lookupError } = await (admin as any)
      .from('artwork_valuations')
      .select('id, artwork_id')
      .eq('id', valuationId)
      .maybeSingle();

    if (lookupError || !valuation) {
      return { success: false, error: 'Valuation not found' };
    }

    const { data: artwork } = await (admin as any)
      .from('artworks')
      .select('account_id, gallery_profile_id')
      .eq('id', valuation.artwork_id)
      .maybeSingle();

    if (!artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    const canEdit = await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    });
    if (!canEdit) {
      return { success: false, error: 'Not permitted' };
    }

    const { error: updateError } = await (admin as any)
      .from('artwork_valuations')
      .update({ is_public: makePublic })
      .eq('id', valuationId);

    if (updateError) {
      console.error('[Valuation] setValuationPublic update failed', updateError);
      return { success: false, error: updateError.message || 'Failed to update valuation' };
    }

    revalidatePath(`/artworks/${valuation.artwork_id}`);
    revalidatePath(`/artworks/${valuation.artwork_id}/certificate`);
    return { success: true };
  } catch (err) {
    console.error('[Valuation] setValuationPublic failed', err);
    return { success: false, error: (err as Error).message || 'Failed to update valuation' };
  }
}
