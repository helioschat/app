import type { Attachment, Chat, Message } from '$lib/types';

export const DB_NAME = 'llmchat';
export const DB_VERSION = 3;
export const THREAD_STORE = 'threads';
export const MESSAGE_STORE = 'messages';
export const ATTACHMENT_STORE = 'attachments';
export const FOLDER_STORE = 'folders';
export const MEMORY_STORE = 'memories';

// A single remembered fact about the user
export type Memory = {
  id: string;
  title: string; // Short label, e.g. "Works as a software engineer"
  content: string; // Full detail, e.g. "User is a senior SWE at Acme Corp"
  keywords: string[]; // Lowercase tokens for fast substring search
  createdAt: Date;
  updatedAt: Date;
  source: 'auto' | 'manual';
};

// Raw Memory as stored in IndexedDB (dates as ISO strings)
export type RawMemory = Omit<Memory, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

// Thread data structure (without messages)
export type Thread = Omit<Chat, 'messages'> & {
  lastMessageDate: Date;
  messageCount: number;
  pinned?: boolean;
  folderId?: string;
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
