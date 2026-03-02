import Exa from 'exa-js';
import type { Tool } from './types';

/**
 * Web search tool powered by the Exa Search API.
 * Uses the exa-js SDK which uses native fetch internally — no CORS issues.
 */
export class ExaSearchTool implements Tool {
  readonly displayName = 'Exa Search';
  readonly displayDescription = 'Web search';

  private exa: Exa;

  constructor(apiKey: string) {
    this.exa = new Exa(apiKey);
  }

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'exa_web_search',
      description:
        'Search the web using Exa Search. Use this to find current information, news, facts, or anything that may benefit from up-to-date web results. Returns a list of web search results including titles, URLs, and relevant highlights.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Supports long, semantically rich descriptions for finding niche content.',
          },
          numResults: {
            type: 'number',
            description: 'Number of results to return (1–10, default 5).',
          },
        },
        required: ['query'],
      },
    },
  };

  async execute(argsJson: string): Promise<unknown> {
    let query: string;
    let numResults: number = 5;

    try {
      const parsed = JSON.parse(argsJson);
      query = parsed.query;
      numResults = Math.min(Math.max(Number(parsed.numResults) || 5, 1), 10);
    } catch {
      return { error: 'Invalid arguments: could not parse JSON.' };
    }

    if (!query || typeof query !== 'string') {
      return { error: 'Invalid arguments: "query" must be a non-empty string.' };
    }

    try {
      const response = await this.exa.search(query, {
        numResults,
        contents: {
          highlights: {
            maxCharacters: 4000,
          },
        },
      });

      return {
        query,
        results: response.results.map((r) => ({
          title: r.title ?? '',
          url: r.url,
          highlights: r.highlights ?? [],
        })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Exa Search request failed: ${message}` };
    }
  }
}
