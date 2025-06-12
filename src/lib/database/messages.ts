import { browser } from '$app/environment';
import { getDB, getStore, promisify } from './connection';
import { MESSAGE_STORE, type RawMessage, type StoredMessage } from './types';

export async function getMessagesForThread(threadId: string): Promise<StoredMessage[]> {
  if (!browser) return [];
  try {
    const db = await getDB();
    const store = getStore(db, MESSAGE_STORE);
    const rawMessages = (await promisify(store.index('threadId').getAll(threadId))) as RawMessage[];

    return rawMessages
      .map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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
    await promisify(store.put(message));
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
