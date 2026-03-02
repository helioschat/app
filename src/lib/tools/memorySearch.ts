import { searchMemories } from '$lib/database/memories';
import type { Tool } from './types';

/**
 * A tool that lets the model search the user's personal memory store.
 * The model should call this proactively whenever it needs context about
 * the user's background, preferences, or previously disclosed information.
 */
export class MemorySearchTool implements Tool {
  readonly displayName = 'Memory Search';
  readonly displayDescription = 'Search personal memories';

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'search_memories',
      description:
        'Search your stored personal memories about the user. ' +
        "Use this proactively when you need context about the user's background, " +
        'preferences, goals, skills, or any details they have shared previously.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keywords or a short phrase describing what you want to recall about the user.',
          },
        },
        required: ['query'],
      },
    },
  };

  async execute(argsJson: string): Promise<unknown> {
    try {
      const { query } = JSON.parse(argsJson) as { query: string };
      if (!query || typeof query !== 'string') {
        return { results: [], message: 'No query provided.' };
      }

      const results = await searchMemories(query.trim(), 10);

      if (results.length === 0) {
        return { results: [], message: 'No relevant memories found for this query.' };
      }

      return {
        results: results.map((m) => ({
          id: m.id,
          title: m.title,
          content: m.content,
        })),
      };
    } catch (err) {
      console.error('MemorySearchTool error:', err);
      return { results: [], message: 'Memory search failed.' };
    }
  }
}
