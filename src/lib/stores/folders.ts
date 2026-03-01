import { browser } from '$app/environment';
import { deleteFolder, getAllFolders, saveFolder } from '$lib/database/folders';
import type { Folder } from '$lib/types';
import { writable } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';

export const folders = writable<Folder[]>([]);

if (browser) {
  getAllFolders().then((loadedFolders) => {
    folders.set(loadedFolders);
  });
}

/**
 * Creates a new folder with the given name and persists it.
 */
export async function createFolder(name: string): Promise<Folder> {
  const folder: Folder = {
    id: uuidv7(),
    name: name.trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  folders.update((all) => [...all].concat(folder).sort((a, b) => a.name.localeCompare(b.name)));

  if (browser) {
    await saveFolder(folder);
  }

  return folder;
}

/**
 * Renames a folder and persists the change.
 */
export async function renameFolder(id: string, newName: string): Promise<void> {
  folders.update((all) => {
    const idx = all.findIndex((f) => f.id === id);
    if (idx === -1) return all;
    const updated = { ...all[idx], name: newName.trim(), updatedAt: new Date() };
    const next = [...all];
    next[idx] = updated;
    next.sort((a, b) => a.name.localeCompare(b.name));
    if (browser) saveFolder(updated);
    return next;
  });
}

/**
 * Deletes a folder by ID. Chats inside the folder become un-foldered.
 * The caller is responsible for un-assigning chats (see chat store).
 */
export async function deleteFolderById(id: string): Promise<void> {
  folders.update((all) => all.filter((f) => f.id !== id));
  if (browser) {
    await deleteFolder(id);
  }
}
