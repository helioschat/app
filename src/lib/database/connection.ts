import { browser } from '$app/environment';
import { ATTACHMENT_STORE, DB_NAME, DB_VERSION, FOLDER_STORE, MESSAGE_STORE, THREAD_STORE } from './types';

// Database connection singleton
let dbPromise: Promise<IDBDatabase> | null = null;

// Initialize the database connection
if (browser) {
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;

      // ── v1 schema (fresh install or upgrading from nothing) ──────────────────
      if (oldVersion < 1) {
        const threadStore = db.createObjectStore(THREAD_STORE, { keyPath: 'id' });
        threadStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        threadStore.createIndex('lastMessageDate', 'lastMessageDate', { unique: false });
        threadStore.createIndex('pinned', 'pinned', { unique: false });

        const messageStore = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
        messageStore.createIndex('threadId', 'threadId', { unique: false });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });

        const attachmentStore = db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
        attachmentStore.createIndex('messageId', 'messageId', { unique: false });
        attachmentStore.createIndex('threadId', 'threadId', { unique: false });
        attachmentStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // ── v2 migration: add folders store + folderId index on threads ──────────
      if (oldVersion < 2) {
        // Create folders store if not already present
        if (!db.objectStoreNames.contains(FOLDER_STORE)) {
          db.createObjectStore(FOLDER_STORE, { keyPath: 'id' });
        }

        // Add folderId index to threads store if not already present
        if (db.objectStoreNames.contains(THREAD_STORE)) {
          const threadStore = transaction.objectStore(THREAD_STORE);
          if (!threadStore.indexNames.contains('folderId')) {
            threadStore.createIndex('folderId', 'folderId', { unique: false });
          }
        }
      }
    };
  });
}

// Helper function to get the database
export async function getDB(): Promise<IDBDatabase> {
  if (!browser || !dbPromise) {
    throw new Error('IndexedDB is not available');
  }
  return dbPromise;
}

// Helper: promisify an IDBRequest so we can await it
export function promisify<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper: open a transaction + store in one go
export function getStore(db: IDBDatabase, store: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}
