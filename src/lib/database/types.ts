import type { Chat, Message } from '$lib/types';

export const DB_NAME = 'llmchat';
export const DB_VERSION = 1;
export const THREAD_STORE = 'threads';
export const MESSAGE_STORE = 'messages';

// Thread data structure (without messages)
export type Thread = Omit<Chat, 'messages'> & {
  lastMessageDate: Date;
  messageCount: number;
  pinned?: boolean;
};

// Message with storage metadata
export type StoredMessage = Message & {
  threadId: string;
  timestamp: Date;
  provider?: string;
};

// Raw data types from IndexedDB before date conversion
export type RawThread = Omit<Thread, 'createdAt' | 'updatedAt' | 'lastMessageDate'> & {
  createdAt: string;
  updatedAt: string;
  lastMessageDate: string;
};

export type RawMessage = Omit<StoredMessage, 'timestamp'> & {
  timestamp: string;
};
