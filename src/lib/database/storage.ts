import { browser } from '$app/environment';
import { getDB } from './connection';
import { ATTACHMENT_STORE, MESSAGE_STORE, THREAD_STORE } from './types';

export interface StoreStorageInfo {
  name: string;
  count: number;
  /** Estimated size in bytes */
  estimatedBytes: number;
}

export interface StorageInfo {
  stores: StoreStorageInfo[];
  /** Total estimated bytes across all stores */
  totalEstimatedBytes: number;
  /** Available quota in bytes (from Storage API), or null if unavailable */
  quota: number | null;
  /** Currently used bytes (from Storage API), or null if unavailable */
  usage: number | null;
}

/**
 * Estimates the serialized size of an IndexedDB value by JSON-stringifying it.
 * This is an approximation since IDB uses a structured clone algorithm.
 */
function estimateSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return 0;
  }
}

async function getStoreInfo(db: IDBDatabase, storeName: string): Promise<StoreStorageInfo> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      let count = 0;
      let estimatedBytes = 0;

      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          count++;
          estimatedBytes += estimateSize(cursor.value);
          cursor.continue();
        } else {
          resolve({ name: storeName, count, estimatedBytes });
        }
      };

      cursorRequest.onerror = () => {
        resolve({ name: storeName, count: 0, estimatedBytes: 0 });
      };
    } catch {
      resolve({ name: storeName, count: 0, estimatedBytes: 0 });
    }
  });
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if (!browser) {
    return {
      stores: [],
      totalEstimatedBytes: 0,
      quota: null,
      usage: null,
    };
  }

  let quota: number | null = null;
  let usage: number | null = null;

  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota ?? null;
      usage = estimate.usage ?? null;
    } catch {
      // Storage API not available or permission denied
    }
  }

  try {
    const db = await getDB();
    const stores = await Promise.all([
      getStoreInfo(db, THREAD_STORE),
      getStoreInfo(db, MESSAGE_STORE),
      getStoreInfo(db, ATTACHMENT_STORE),
    ]);

    const totalEstimatedBytes = stores.reduce((sum, s) => sum + s.estimatedBytes, 0);

    return { stores, totalEstimatedBytes, quota, usage };
  } catch {
    return {
      stores: [],
      totalEstimatedBytes: 0,
      quota,
      usage,
    };
  }
}
