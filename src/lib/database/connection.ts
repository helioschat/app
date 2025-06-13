import { browser } from '$app/environment';
import { ATTACHMENT_STORE, DB_NAME, DB_VERSION, MESSAGE_STORE, THREAD_STORE } from './types';

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

      // Create the threads store if it doesn't exist
      if (!db.objectStoreNames.contains(THREAD_STORE)) {
        const threadStore = db.createObjectStore(THREAD_STORE, { keyPath: 'id' });
        threadStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        threadStore.createIndex('lastMessageDate', 'lastMessageDate', { unique: false });
        threadStore.createIndex('pinned', 'pinned', { unique: false });
      }

      // Create the messages store if it doesn't exist
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        const messageStore = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
        messageStore.createIndex('threadId', 'threadId', { unique: false });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create the attachments store if it doesn't exist
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) {
        const attachmentStore = db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
        attachmentStore.createIndex('messageId', 'messageId', { unique: false });
        attachmentStore.createIndex('threadId', 'threadId', { unique: false });
        attachmentStore.createIndex('createdAt', 'createdAt', { unique: false });
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
