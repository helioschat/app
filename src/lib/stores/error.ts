import { writable } from 'svelte/store';

export interface ChatError {
  message: string;
  type: string;
  param?: string | null;
  code?: string;
  provider?: string;
}

// Create a writable store for chat errors
export const chatError = writable<ChatError | null>(null);

// Helper function to set an error
export function setChatError(error: ChatError) {
  chatError.set(error);
}

// Helper function to clear the error
export function clearChatError() {
  chatError.set(null);
}
