import { browser } from '$app/environment';
import { getDB, getStore, promisify } from './connection';
import { ATTACHMENT_STORE, type RawAttachment, type StoredAttachment } from './types';

export async function getAttachmentsForMessage(messageId: string): Promise<StoredAttachment[]> {
  if (!browser) return [];
  try {
    const db = await getDB();
    const store = getStore(db, ATTACHMENT_STORE);
    const rawAttachments = (await promisify(store.index('messageId').getAll(messageId))) as RawAttachment[];

    return rawAttachments
      .map((attachment) => ({
        ...attachment,
        createdAt: new Date(attachment.createdAt),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    console.error('Error getting attachments from IndexedDB:', error);
    return [];
  }
}

export async function getAttachmentsForThread(threadId: string): Promise<StoredAttachment[]> {
  if (!browser) return [];
  try {
    const db = await getDB();
    const store = getStore(db, ATTACHMENT_STORE);
    const rawAttachments = (await promisify(store.index('threadId').getAll(threadId))) as RawAttachment[];

    return rawAttachments
      .map((attachment) => ({
        ...attachment,
        createdAt: new Date(attachment.createdAt),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    console.error('Error getting attachments from IndexedDB:', error);
    return [];
  }
}

export async function saveAttachment(attachment: StoredAttachment): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, ATTACHMENT_STORE, 'readwrite');
    await promisify(store.put(attachment));
  } catch (error) {
    console.error('Error saving attachment to IndexedDB:', error);
  }
}

export async function saveAttachments(attachments: StoredAttachment[]): Promise<void> {
  if (!browser || attachments.length === 0) return;
  try {
    const db = await getDB();
    const store = getStore(db, ATTACHMENT_STORE, 'readwrite');
    await Promise.all(attachments.map((attachment) => promisify(store.put(attachment))));
  } catch (error) {
    console.error('Error saving attachments to IndexedDB:', error);
  }
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  if (!browser) return;
  try {
    const db = await getDB();
    const store = getStore(db, ATTACHMENT_STORE, 'readwrite');
    await promisify(store.delete(attachmentId));
  } catch (error) {
    console.error('Error deleting attachment from IndexedDB:', error);
  }
}

export async function deleteAttachmentsForMessage(messageId: string): Promise<void> {
  if (!browser) return;
  try {
    const attachments = await getAttachmentsForMessage(messageId);
    if (attachments.length === 0) return;

    const db = await getDB();
    const store = getStore(db, ATTACHMENT_STORE, 'readwrite');
    await Promise.all(attachments.map((attachment) => promisify(store.delete(attachment.id))));
  } catch (error) {
    console.error('Error deleting attachments from IndexedDB:', error);
  }
}

export async function deleteAttachmentsForThread(threadId: string): Promise<void> {
  if (!browser) return;
  try {
    const attachments = await getAttachmentsForThread(threadId);
    if (attachments.length === 0) return;

    const db = await getDB();
    const store = getStore(db, ATTACHMENT_STORE, 'readwrite');
    await Promise.all(attachments.map((attachment) => promisify(store.delete(attachment.id))));
  } catch (error) {
    console.error('Error deleting attachments from IndexedDB:', error);
  }
}
