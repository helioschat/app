import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';

export interface StreamContextMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
}

export type StreamState = {
  threadId: string;
  messageId: string;
  isStreaming: boolean;
  startTime: number;
  partialContent: string; // Track the current content for resume
  contextMessages: StreamContextMessage[]; // Store context for resuming
};

const STREAM_STATE_KEY = 'llmchat-stream-state';

// Create a writable store for the current stream state
export const streamState: Writable<StreamState | null> = writable<StreamState | null>(null);

// Initialize the stream state from storage
if (browser) {
  try {
    const savedState = localStorage.getItem(STREAM_STATE_KEY);
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      // Ensure partialContent exists
      if (!parsedState.partialContent) {
        parsedState.partialContent = '';
      }
      // Ensure contextMessages exists
      if (!parsedState.contextMessages) {
        parsedState.contextMessages = [];
      }
      streamState.set(parsedState);
    }
  } catch (error) {
    console.error('Error loading stream state:', error);
  }

  // Subscribe to changes and save to localStorage
  streamState.subscribe((state) => {
    if (state) {
      localStorage.setItem(STREAM_STATE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STREAM_STATE_KEY);
    }
  });
}

// Start streaming and record state with context messages
export function startStream(threadId: string, messageId: string, contextMessages: StreamContextMessage[]): void {
  streamState.set({
    threadId,
    messageId,
    isStreaming: true,
    startTime: Date.now(),
    partialContent: '', // Initialize with empty content
    contextMessages: contextMessages, // Store the context messages for resuming
  });
}

// Update the partial content as it's generated
export function updateStreamContent(content: string): void {
  streamState.update((state) => {
    if (state) {
      return { ...state, partialContent: content };
    }
    return state;
  });
}

// End streaming and clear state
export function endStream(): void {
  streamState.set(null);
}

// Check if a specific message is currently streaming
export function isMessageStreaming(threadId: string, messageId: string): boolean {
  let result = false;
  const unsubscribe = streamState.subscribe((state) => {
    result = !!state && state.threadId === threadId && state.messageId === messageId && state.isStreaming;
  });
  unsubscribe();
  return result;
}

// Get the current partial content
export function getPartialContent(): string | null {
  let content: string | null = null;
  const unsubscribe = streamState.subscribe((state) => {
    content = state?.partialContent || null;
  });
  unsubscribe();
  return content;
}

// Get the context messages for resuming
export function getContextMessages(): StreamContextMessage[] | null {
  let messages = null;
  const unsubscribe = streamState.subscribe((state) => {
    messages = state?.contextMessages || null;
  });
  unsubscribe();
  return messages;
}
