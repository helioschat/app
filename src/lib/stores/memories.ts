import { browser } from '$app/environment';
import { clearAllMemories, deleteMemory, getAllMemories, saveMemory } from '$lib/database/memories';
import type { Memory } from '$lib/database/types';
import { writable } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';

// ── Reactive store ────────────────────────────────────────────────────────────

/** All memories, newest first. Kept in sync with IndexedDB. */
export const memories = writable<Memory[]>([]);

/** Whether the memories store has finished its initial load. */
export const memoriesLoaded = writable<boolean>(false);

// Load from IndexedDB on startup (browser only)
if (browser) {
  getAllMemories()
    .then((all) => {
      memories.set(all);
      memoriesLoaded.set(true);
    })
    .catch((err) => {
      console.error('Failed to load memories from IndexedDB:', err);
      memoriesLoaded.set(true);
    });
}

// ── Mutation helpers ──────────────────────────────────────────────────────────

/**
 * Add or update a memory in the store and IndexedDB.
 */
export async function upsertMemory(memory: Memory): Promise<void> {
  await saveMemory(memory);
  memories.update((all) => {
    const idx = all.findIndex((m) => m.id === memory.id);
    if (idx >= 0) {
      const updated = [...all];
      updated[idx] = memory;
      return updated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return [memory, ...all];
  });
}

/**
 * Create a new manual memory entry.
 */
export async function addManualMemory(title: string, content: string): Promise<Memory> {
  const keywords = extractKeywords(title + ' ' + content);
  const now = new Date();
  const memory: Memory = {
    id: uuidv7(),
    title: title.trim(),
    content: content.trim(),
    keywords,
    createdAt: now,
    updatedAt: now,
    source: 'manual',
  };
  await upsertMemory(memory);
  return memory;
}

/**
 * Remove a memory from the store and IndexedDB.
 */
export async function removeMemory(id: string): Promise<void> {
  await deleteMemory(id);
  memories.update((all) => all.filter((m) => m.id !== id));
}

/**
 * Clear all memories from the store and IndexedDB.
 */
export async function clearMemories(): Promise<void> {
  await clearAllMemories();
  memories.set([]);
}

// ── Keyword extraction helper ─────────────────────────────────────────────────

/**
 * Extract lowercase keyword tokens from a text string.
 * Filters out common English stop words and very short tokens.
 */
export function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'has',
    'have',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'this',
    'that',
    'it',
    'he',
    'she',
    'they',
    'we',
    'i',
    'my',
    'your',
    'their',
    'his',
    'her',
    'user',
    'as',
    'so',
  ]);

  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t)),
    ),
  ];
}
