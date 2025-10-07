import { browser } from '$app/environment';
import { getDB, getStore, promisify } from '$lib/database/connection';
import { ATTACHMENT_STORE, DB_NAME, MESSAGE_STORE, THREAD_STORE } from '$lib/database/types';

interface ExportData {
  threads: unknown[];
  messages: unknown[];
  attachments: unknown[];
  localStorage: Record<string, string>;
  metadata: {
    exportDate: string;
    version: string;
  };
}

// Keys to exclude from localStorage export
const EXCLUDED_LOCALSTORAGE_KEYS = ['modelCache', 'machineId', 'authState'];

/**
 * Clear all application data (IndexedDB and localStorage)
 * @param closeDatabase - Whether to close and delete the database (default: true)
 */
export async function clearAllData(closeDatabase: boolean = true): Promise<void> {
  if (!browser) return;

  try {
    // Clear all localStorage keys
    localStorage.clear();

    if (closeDatabase) {
      // Clear IndexedDB by deleting the entire database
      const db = await getDB();
      db.close();

      // Delete the entire database
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => {
          console.warn('Database deletion blocked. Please close all other tabs.');
          resolve(); // Still resolve to continue
        };
      });
    } else {
      // Clear all stores without closing the database
      const db = await getDB();

      const threadsStore = getStore(db, THREAD_STORE, 'readwrite');
      const messagesStore = getStore(db, MESSAGE_STORE, 'readwrite');
      const attachmentsStore = getStore(db, ATTACHMENT_STORE, 'readwrite');

      await Promise.all([
        promisify(threadsStore.clear()),
        promisify(messagesStore.clear()),
        promisify(attachmentsStore.clear()),
      ]);
    }

    console.log('All application data cleared successfully');
  } catch (error) {
    console.error('Error clearing application data:', error);
    throw new Error('Failed to clear application data');
  }
} /**
 * Export all user data to a JSON file
 */
export async function exportUserData(): Promise<void> {
  if (!browser) return;

  try {
    // Get all data from IndexedDB
    const db = await getDB();

    const threadsStore = getStore(db, THREAD_STORE);
    const messagesStore = getStore(db, MESSAGE_STORE);
    const attachmentsStore = getStore(db, ATTACHMENT_STORE);

    const [threads, messages, attachments] = await Promise.all([
      promisify(threadsStore.getAll()),
      promisify(messagesStore.getAll()),
      promisify(attachmentsStore.getAll()),
    ]);

    // Get localStorage data (excluding modelCache and other excluded keys)
    const localStorageData: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !EXCLUDED_LOCALSTORAGE_KEYS.includes(key)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          localStorageData[key] = value;
        }
      }
    }

    const exportData: ExportData = {
      threads,
      messages,
      attachments,
      localStorage: localStorageData,
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
      },
    };

    // Create and download the JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    a.download = `llmchat-export-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting user data:', error);
    throw new Error('Failed to export user data');
  }
}

/**
 * Import user data from a JSON file
 */
export async function importUserData(file: File): Promise<void> {
  if (!browser) return;

  try {
    // Read and parse the JSON file
    const text = await file.text();
    const importData: ExportData = JSON.parse(text);

    // Validate import data structure
    if (!importData.threads || !importData.messages || !importData.attachments || !importData.localStorage) {
      throw new Error('Invalid export file: missing required data');
    }

    // Clear all existing data but keep the database connection open
    await clearAllData(false);

    // Get the database connection (it's still open)
    const db = await getDB();

    // Import IndexedDB data
    const importPromises = [
      // Import threads
      ...importData.threads.map((thread) => promisify(getStore(db, THREAD_STORE, 'readwrite').put(thread))),
      // Import messages
      ...importData.messages.map((message) => promisify(getStore(db, MESSAGE_STORE, 'readwrite').put(message))),
      // Import attachments
      ...importData.attachments.map((attachment) =>
        promisify(getStore(db, ATTACHMENT_STORE, 'readwrite').put(attachment)),
      ),
    ];

    await Promise.all(importPromises);

    // Restore localStorage data
    for (const [key, value] of Object.entries(importData.localStorage)) {
      localStorage.setItem(key, value);
    }

    console.log('User data imported successfully');
  } catch (error) {
    console.error('Error importing user data:', error);
    throw new Error('Failed to import user data');
  }
}
