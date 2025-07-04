import { browser } from '$app/environment';
import type { ChatError } from '$lib/types';
import { getDB, getStore, promisify } from './connection';
import { MESSAGE_STORE, type RawMessage, type StoredMessage } from './types';

// Helper to create a temporary object URL from base64 encoded data
export function createPreviewUrl(base64Data: string, mimeType: string): string {
  const binary = atob(base64Data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function getMessagesForThread(threadId: string): Promise<StoredMessage[]> {
  if (!browser) return [];
  try {
    const db = await getDB();
    const store = getStore(db, MESSAGE_STORE);
    const rawMessages = (await promisify(store.index('threadId').getAll(threadId))) as RawMessage[];

    // Convert raw messages without loading attachments
    const messages = rawMessages.map(
      (msg) =>
        ({
          ...msg,
          createdAt: new Date(msg.createdAt),
          updatedAt: new Date(msg.updatedAt),
          error: msg.error ? (JSON.parse(msg.error) as ChatError) : undefined,
        }) as StoredMessage,
    );

    return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    console.error('Error getting messages from IndexedDB:', error);
    return [];
  }
}

export async function saveMessage(message: StoredMessage): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, MESSAGE_STORE, 'readwrite');

    // Serialize the message for storage, handling the error field
    const messageToStore: RawMessage = {
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      error: message.error ? JSON.stringify(message.error) : undefined,
    };

    await promisify(store.put(messageToStore));
  } catch (error) {
    console.error('Error saving message to IndexedDB:', error);
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, MESSAGE_STORE, 'readwrite');
    await promisify(store.delete(messageId));
  } catch (error) {
    console.error('Error deleting message from IndexedDB:', error);
  }
}

export async function deleteMessagesForThread(threadId: string): Promise<void> {
  if (!browser) return;
  try {
    const messages = await getMessagesForThread(threadId);
    if (messages.length === 0) return;

    const db = await getDB();
    const store = getStore(db, MESSAGE_STORE, 'readwrite');
    await Promise.all(messages.map((m) => promisify(store.delete(m.id))));
  } catch (error) {
    console.error('Error deleting messages from IndexedDB:', error);
  }
}
