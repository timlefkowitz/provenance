import type OpenAI from 'openai';

/**
 * Model used for every web-search call (press discovery, artist research,
 * Taco's search_press, valuation research). Responses API + the web_search
 * tool; the old Chat Completions model gpt-4o-search-preview was retired.
 */
export const WEB_SEARCH_MODEL = 'gpt-5.1';

/**
 * Run one web-searching prompt and return the model's final text. Callers
 * ask for JSON in the prompt and parse it themselves (parseJsonLoose).
 */
export async function webSearchText(
  openai: OpenAI,
  opts: { instructions: string; input: string },
): Promise<string> {
  const response = await openai.responses.create({
    model: WEB_SEARCH_MODEL,
    tools: [{ type: 'web_search' } as never],
    instructions: opts.instructions,
    input: opts.input,
  });
  return response.output_text ?? '';
}
