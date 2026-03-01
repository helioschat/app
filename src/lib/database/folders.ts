import { browser } from '$app/environment';
import type { Folder } from '$lib/types';
import { getDB, getStore, promisify } from './connection';
import { FOLDER_STORE } from './types';

type RawFolder = Omit<Folder, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export async function getAllFolders(): Promise<Folder[]> {
  if (!browser) return [];

  try {
    const db = await getDB();
    const store = getStore(db, FOLDER_STORE);
    const rawFolders = (await promisify(store.getAll())) as RawFolder[];

    return rawFolders
      .map((folder) => ({
        ...folder,
        createdAt: new Date(folder.createdAt),
        updatedAt: new Date(folder.updatedAt),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error getting folders from IndexedDB:', error);
    return [];
  }
}

export async function saveFolder(folder: Folder): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, FOLDER_STORE, 'readwrite');
    await promisify(store.put(folder));
  } catch (error) {
    console.error('Error saving folder to IndexedDB:', error);
  }
}

export async function deleteFolder(id: string): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, FOLDER_STORE, 'readwrite');
    await promisify(store.delete(id));
  } catch (error) {
    console.error('Error deleting folder from IndexedDB:', error);
  }
}
