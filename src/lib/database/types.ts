import type { Attachment, Chat, Message } from '$lib/types';

export const DB_NAME = 'llmchat';
export const DB_VERSION = 1;
export const THREAD_STORE = 'threads';
export const MESSAGE_STORE = 'messages';
export const ATTACHMENT_STORE = 'attachments';

// Thread data structure (without messages)
export type Thread = Omit<Chat, 'messages'> & {
  lastMessageDate: Date;
  messageCount: number;
  pinned?: boolean;
};

// Message with storage metadata
export type StoredMessage = Message & {
  threadId: string;
  provider?: string;
};

// Attachment data structure for storage
export type StoredAttachment = Omit<Attachment, 'previewUrl'> & {
  messageId: string;
  threadId: string;
  createdAt: Date;
};

// Raw data types from IndexedDB before date conversion
export type RawThread = Omit<Thread, 'createdAt' | 'updatedAt' | 'lastMessageDate'> & {
  createdAt: string;
  updatedAt: string;
  lastMessageDate: string;
};

export type RawMessage = Omit<StoredMessage, 'createdAt' | 'updatedAt' | 'error'> & {
  createdAt: string;
  updatedAt: string;
  error?: string; // JSON serialized ChatError
};

// Raw attachment data from IndexedDB before date conversion
export type RawAttachment = Omit<StoredAttachment, 'createdAt'> & {
  createdAt: string;
};
