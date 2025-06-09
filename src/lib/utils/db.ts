import { browser } from '$app/environment';
import type { Chat, Message } from '$lib/types';

const DB_NAME = 'llmchat';
const DB_VERSION = 1;
const THREAD_STORE = 'threads';
const MESSAGE_STORE = 'messages';

// Thread data structure (without messages)
export type Thread = Omit<Chat, 'messages'> & {
  lastMessageDate: Date;
  messageCount: number;
  provider?: string;
  model?: string;
  pinned?: boolean;
};

// Raw thread data from IndexedDB before date conversion
type RawThread = Omit<Thread, 'createdAt' | 'updatedAt' | 'lastMessageDate'> & {
  createdAt: string;
  updatedAt: string;
  lastMessageDate: string;
};

// Raw message data from IndexedDB before date conversion
type RawMessage = Omit<StoredMessage, 'timestamp'> & {
  timestamp: string;
};

// Initialize the database
let dbPromise: Promise<IDBDatabase> | null = null;

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
    };
  });
}

// Helper function to get the database
async function getDB(): Promise<IDBDatabase> {
  if (!browser || !dbPromise) {
    throw new Error('IndexedDB is not available');
  }
  return dbPromise;
}

// Thread operations
export async function getAllThreads(): Promise<Thread[]> {
  if (!browser) return [];

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(THREAD_STORE, 'readonly');
      const store = transaction.objectStore(THREAD_STORE);
      const request = store.index('lastMessageDate').getAll();

      request.onsuccess = () => {
        // Convert dates back to Date objects
        const threads = request.result.map((thread: RawThread) => ({
          ...thread,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
          lastMessageDate: new Date(thread.lastMessageDate),
        }));

        // Sort by lastMessageDate in descending order
        threads.sort((a: Thread, b: Thread) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime());
        resolve(threads);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error getting threads from IndexedDB:', error);
    return [];
  }
}

export async function saveThread(thread: Thread): Promise<void> {
  if (!browser) return;

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(THREAD_STORE, 'readwrite');
      const store = transaction.objectStore(THREAD_STORE);
      const request = store.put(thread);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error saving thread to IndexedDB:', error);
  }
}

export async function getThread(id: string): Promise<Thread | null> {
  if (!browser) return null;

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(THREAD_STORE, 'readonly');
      const store = transaction.objectStore(THREAD_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          // Convert dates back to Date objects
          const thread = {
            ...request.result,
            createdAt: new Date(request.result.createdAt),
            updatedAt: new Date(request.result.updatedAt),
            lastMessageDate: new Date(request.result.lastMessageDate),
          };
          resolve(thread);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error getting thread from IndexedDB:', error);
    return null;
  }
}

export async function deleteThread(id: string): Promise<void> {
  if (!browser) return;

  try {
    const db = await getDB();
    // First delete all messages for this thread
    await deleteMessagesForThread(id);

    // Then delete the thread itself
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(THREAD_STORE, 'readwrite');
      const store = transaction.objectStore(THREAD_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error deleting thread from IndexedDB:', error);
  }
}

// Message operations
export type StoredMessage = Message & {
  threadId: string;
  timestamp: Date;
  provider?: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metrics?: {
    startTime?: number;
    endTime?: number;
    totalTime?: number;
    tokensPerSecond?: number;
  };
};

export async function getMessagesForThread(threadId: string): Promise<StoredMessage[]> {
  if (!browser) return [];

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGE_STORE, 'readonly');
      const store = transaction.objectStore(MESSAGE_STORE);
      const index = store.index('threadId');
      const request = index.getAll(threadId);

      request.onsuccess = () => {
        // Convert dates back to Date objects and sort by timestamp
        const messages = request.result.map((message: RawMessage) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        }));

        // Sort by timestamp in ascending order
        messages.sort((a: StoredMessage, b: StoredMessage) => a.timestamp.getTime() - b.timestamp.getTime());
        resolve(messages);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error getting messages from IndexedDB:', error);
    return [];
  }
}

export async function saveMessage(message: StoredMessage): Promise<void> {
  if (!browser) return;

  try {
    const db = await getDB();

    // Save the message
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(MESSAGE_STORE, 'readwrite');
      const store = transaction.objectStore(MESSAGE_STORE);
      const request = store.put(message);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    // Update the thread's lastMessageDate and messageCount
    const thread = await getThread(message.threadId);
    if (thread) {
      thread.lastMessageDate = message.timestamp;

      // Get the actual count of messages for this thread
      const messages = await getMessagesForThread(message.threadId);
      thread.messageCount = messages.length;

      thread.updatedAt = new Date();

      await saveThread(thread);
    } else {
      console.error('Thread not found when saving message:', message.threadId);
    }
  } catch (error) {
    console.error('Error saving message to IndexedDB:', error);
  }
}

export async function deleteMessagesForThread(threadId: string): Promise<void> {
  if (!browser) return;

  try {
    const db = await getDB();
    const messages = await getMessagesForThread(threadId);

    const transaction = db.transaction(MESSAGE_STORE, 'readwrite');
    const store = transaction.objectStore(MESSAGE_STORE);

    // Delete each message
    const deletePromises = messages.map(
      (message) =>
        new Promise<void>((resolve, reject) => {
          const request = store.delete(message.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    );

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting messages from IndexedDB:', error);
  }
}

// Utility functions to convert between Chat and Thread + Messages
export async function getChatFromThread(threadId: string): Promise<Chat | null> {
  const thread = await getThread(threadId);
  if (!thread) return null;

  const messages = await getMessagesForThread(threadId);

  // If no messages were found but thread exists, delete the thread
  if (messages.length === 0) {
    await deleteThread(threadId);
    return null;
  }

  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: messages.map(({ id, role, content, provider, model, usage, metrics }) => ({
      id,
      role,
      content,
      provider,
      model,
      usage,
      metrics,
    })),
    provider: thread.provider,
    model: thread.model,
  };
}

// Simple mutex to prevent concurrent saves of the same chat
const saveMutex: Record<string, boolean> = {};

export async function saveChatAsThreadAndMessages(chat: Chat): Promise<void> {
  try {
    // Check if we're already saving this chat
    if (saveMutex[chat.id]) {
      console.debug('Already saving chat, skipping duplicate save:', chat.id);
      return;
    }

    // Set mutex
    saveMutex[chat.id] = true;

    // Create or update the thread
    const thread: Thread = {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessageDate: chat.messages.length > 0 ? chat.updatedAt : chat.createdAt,
      messageCount: chat.messages.length,
      provider: chat.provider,
      model: chat.model,
    };

    await saveThread(thread);

    // Save each message with proper timestamps and metadata
    if (chat.messages.length > 0) {
      // First, get existing messages to check what we need to update
      const existingMessages = await getMessagesForThread(chat.id);

      const saveMessagePromises = chat.messages.map((message, index) => {
        // Create a timestamp based on message position if not available in metrics
        let timestamp: Date;
        if (message.metrics?.startTime) {
          timestamp = new Date(message.metrics.startTime);
        } else {
          timestamp = new Date(chat.createdAt.getTime() + index * 1000);
        }

        const storedMessage: StoredMessage = {
          ...message,
          threadId: chat.id,
          timestamp,
        };

        return saveMessage(storedMessage);
      });

      await Promise.all(saveMessagePromises);

      // Delete any messages that are no longer in the chat
      const currentIds = new Set(chat.messages.map((msg) => msg.id));
      const messagesToDelete = existingMessages.filter((msg) => !currentIds.has(msg.id));

      if (messagesToDelete.length > 0) {
        const deletePromises = messagesToDelete.map(async (message) => {
          const db = await getDB();
          return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(MESSAGE_STORE, 'readwrite');
            const store = transaction.objectStore(MESSAGE_STORE);
            const request = store.delete(message.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        });

        await Promise.all(deletePromises);
      }
    } else {
      console.debug('No messages to save for chat:', chat.id);
    }
  } catch (error) {
    console.error('Error saving chat to IndexedDB:', error);
  } finally {
    // Release mutex
    saveMutex[chat.id] = false;
  }
}
