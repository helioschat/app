import { deleteMemory, saveMemory, searchMemories } from '$lib/database/memories';
import { extractKeywords, memories } from '$lib/stores/memories';
import { v7 as uuidv7 } from 'uuid';
import type { Tool } from './types';

/**
 * A single tool that lets the model search, save, and delete personal memories.
 *
 * Modes:
 *   - search: find relevant memories by keyword query
 *   - save:   create or update a memory
 *   - delete: remove a memory by ID
 */
export class ManageMemoriesTool implements Tool {
  readonly displayName = 'Memory';
  readonly displayDescription = 'Manage personal memories';

  readonly definition = {
    type: 'function' as const,
    function: {
      name: 'manage_memories',
      description:
        "Manage the user's personal memory store. Use this to search for previously stored facts, " +
        'save new facts the user discloses (name, job, location, preferences, goals, skills, etc.), ' +
        'or delete outdated/incorrect memories. ' +
        'Always search before saving to avoid duplicates. ' +
        'Save memories proactively whenever the user shares personal, enduring information.',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['search', 'save', 'delete'],
            description:
              '"search" — find relevant memories using a query string. ' +
              '"save" — store a new memory (title + content required). ' +
              '"delete" — remove a memory by its ID.',
          },
          query: {
            type: 'string',
            description: '(mode=search) Keywords or phrase describing what to recall.',
          },
          title: {
            type: 'string',
            description: '(mode=save) Short, descriptive title for the memory (e.g. "Works as a software engineer").',
          },
          content: {
            type: 'string',
            description: '(mode=save) Full detail of the memory.',
          },
          id: {
            type: 'string',
            description: '(mode=delete) The ID of the memory to delete (obtained from a prior search).',
          },
        },
        required: ['mode'],
      },
    },
  };

  async execute(argsJson: string): Promise<unknown> {
    try {
      const args = JSON.parse(argsJson) as {
        mode: 'search' | 'save' | 'delete';
        query?: string;
        title?: string;
        content?: string;
        id?: string;
      };

      switch (args.mode) {
        case 'search': {
          const query = (args.query ?? '').trim();
          if (!query) {
            return { success: false, message: 'No query provided for search.' };
          }
          const results = await searchMemories(query, 10);
          if (results.length === 0) {
            return { success: true, results: [], message: 'No relevant memories found.' };
          }
          return {
            success: true,
            results: results.map((m) => ({ id: m.id, title: m.title, content: m.content })),
          };
        }

        case 'save': {
          const title = (args.title ?? '').trim();
          const content = (args.content ?? '').trim();
          if (!title || !content) {
            return { success: false, message: 'Both title and content are required to save a memory.' };
          }
          const now = new Date();
          const memory = {
            id: uuidv7(),
            title,
            content,
            keywords: extractKeywords(title + ' ' + content),
            createdAt: now,
            updatedAt: now,
            source: 'auto' as const,
          };
          await saveMemory(memory);
          // Keep the Svelte store in sync
          memories.update((all) => [memory, ...all]);
          return { success: true, id: memory.id, message: 'Memory saved.' };
        }

        case 'delete': {
          const id = (args.id ?? '').trim();
          if (!id) {
            return { success: false, message: 'No ID provided for delete.' };
          }
          await deleteMemory(id);
          // Keep the Svelte store in sync
          memories.update((all) => all.filter((m) => m.id !== id));
          return { success: true, message: 'Memory deleted.' };
        }

        default:
          return { success: false, message: `Unknown mode: ${(args as { mode: string }).mode}` };
      }
    } catch (err) {
      console.error('ManageMemoriesTool error:', err);
      return { success: false, message: 'Memory operation failed.' };
    }
  }
}
