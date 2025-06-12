import { browser } from '$app/environment';
import { getDB, getStore, promisify } from './connection';
import { THREAD_STORE, type RawThread, type Thread } from './types';

export async function getAllThreads(): Promise<Thread[]> {
  if (!browser) return [];

  try {
    const db = await getDB();
    const store = getStore(db, THREAD_STORE);
    const rawThreads = (await promisify(store.index('lastMessageDate').getAll())) as RawThread[];

    return rawThreads
      .map((thread) => ({
        ...thread,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.updatedAt),
        lastMessageDate: new Date(thread.lastMessageDate),
      }))
      .sort((a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime());
  } catch (error) {
    console.error('Error getting threads from IndexedDB:', error);
    return [];
  }
}

export async function saveThread(thread: Thread): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, THREAD_STORE, 'readwrite');
    await promisify(store.put(thread));
  } catch (error) {
    console.error('Error saving thread to IndexedDB:', error);
  }
}

export async function getThread(id: string): Promise<Thread | null> {
  if (!browser) return null;
  try {
    const db = await getDB();
    const store = getStore(db, THREAD_STORE);
    const thread = (await promisify(store.get(id))) as RawThread | undefined;
    if (!thread) return null;

    return {
      ...thread,
      createdAt: new Date(thread.createdAt),
      updatedAt: new Date(thread.updatedAt),
      lastMessageDate: new Date(thread.lastMessageDate),
    };
  } catch (error) {
    console.error('Error retrieving thread from IndexedDB:', error);
    return null;
  }
}

export async function deleteThread(id: string): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, THREAD_STORE, 'readwrite');
    await promisify(store.delete(id));
  } catch (error) {
    console.error('Error deleting thread from IndexedDB:', error);
  }
}
