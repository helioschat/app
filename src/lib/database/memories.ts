import { getDB, getStore, promisify } from './connection';
import { MEMORY_STORE, type Memory, type RawMemory } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function rawToMemory(raw: RawMemory): Memory {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function memoryToRaw(memory: Memory): RawMemory {
  return {
    ...memory,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Retrieve all memories, sorted newest-first.
 */
export async function getAllMemories(): Promise<Memory[]> {
  const db = await getDB();
  const store = getStore(db, MEMORY_STORE, 'readonly');
  const raws = await promisify<RawMemory[]>(store.getAll() as IDBRequest<RawMemory[]>);
  const memories = raws.map(rawToMemory);
  memories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return memories;
}

/**
 * Retrieve a single memory by ID.
 */
export async function getMemoryById(id: string): Promise<Memory | null> {
  const db = await getDB();
  const store = getStore(db, MEMORY_STORE, 'readonly');
  const raw = await promisify<RawMemory | undefined>(store.get(id) as IDBRequest<RawMemory | undefined>);
  return raw ? rawToMemory(raw) : null;
}

/**
 * Save (insert or overwrite) a memory.
 */
export async function saveMemory(memory: Memory): Promise<void> {
  const db = await getDB();
  const store = getStore(db, MEMORY_STORE, 'readwrite');
  await promisify(store.put(memoryToRaw(memory)));
}

/**
 * Delete a memory by ID.
 */
export async function deleteMemory(id: string): Promise<void> {
  const db = await getDB();
  const store = getStore(db, MEMORY_STORE, 'readwrite');
  await promisify(store.delete(id));
}

/**
 * Delete all memories.
 */
export async function clearAllMemories(): Promise<void> {
  const db = await getDB();
  const store = getStore(db, MEMORY_STORE, 'readwrite');
  await promisify(store.clear());
}

/**
 * Search memories by keyword query.
 * Splits the query into tokens and returns memories where any token appears
 * in the title, content, or keywords array (case-insensitive substring match).
 * Returns up to `limit` results.
 */
export async function searchMemories(query: string, limit = 10): Promise<Memory[]> {
  const memories = await getAllMemories();
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return memories.slice(0, limit);

  const matched = memories.filter((m) => {
    const haystack = [m.title.toLowerCase(), m.content.toLowerCase(), ...m.keywords.map((k) => k.toLowerCase())].join(
      ' ',
    );
    return tokens.some((token) => haystack.includes(token));
  });

  return matched.slice(0, limit);
}

/**
 * Find a memory whose title is sufficiently similar to the given title
 * (normalized, case-insensitive exact match after stripping punctuation).
 * Used for deduplication during auto-extraction.
 */
export async function findMemoryByTitle(title: string): Promise<Memory | null> {
  const normalized = normalizeTitle(title);
  const all = await getAllMemories();
  return all.find((m) => normalizeTitle(m.title) === normalized) ?? null;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
