import { browser } from '$app/environment';
import { writable, type Writable, get } from 'svelte/store';

export interface StreamContextMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  providerInstanceId?: string;
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

const STREAM_STATE_KEY = 'llmchat-stream-states'; // Renamed for new structure

// Create a writable store for multiple stream states, indexed by threadId
export const streamStates: Writable<Record<string, StreamState>> = writable({});

// Initialize stream states from storage
if (browser) {
  try {
    const savedStates = localStorage.getItem(STREAM_STATE_KEY);
    if (savedStates) {
      const parsedStates = JSON.parse(savedStates);
      // Basic validation
      if (typeof parsedStates === 'object' && parsedStates !== null) {
        // Ensure nested properties exist
        for (const threadId in parsedStates) {
          if (Object.prototype.hasOwnProperty.call(parsedStates, threadId)) {
            const state = parsedStates[threadId];
            if (!state.partialContent) {
              state.partialContent = '';
            }
            if (!state.contextMessages) {
              state.contextMessages = [];
            }
          }
        }
        streamStates.set(parsedStates);
      }
    }
  } catch (error) {
    console.error('Error loading stream states:', error);
  }

  // Subscribe to changes and save to localStorage
  streamStates.subscribe((states) => {
    if (Object.keys(states).length > 0) {
      localStorage.setItem(STREAM_STATE_KEY, JSON.stringify(states));
    } else {
      localStorage.removeItem(STREAM_STATE_KEY);
    }
  });
}

// Start streaming for a specific thread
export function startStream(
  threadId: string,
  messageId: string,
  contextMessages: StreamContextMessage[]
): void {
  streamStates.update((states) => {
    states[threadId] = {
      threadId,
      messageId,
      isStreaming: true,
      startTime: Date.now(),
      partialContent: '',
      contextMessages: contextMessages
    };
    return states;
  });
}

// Update the partial content for a specific thread
export function updateStreamContent(threadId: string, content: string): void {
  streamStates.update((states) => {
    if (states[threadId]) {
      states[threadId].partialContent = content;
    }
    return states;
  });
}

// End streaming for a specific thread
export function endStream(threadId: string): void {
  streamStates.update((states) => {
    delete states[threadId];
    return states;
  });
}

// Check if a specific message is currently streaming in a thread
export function isMessageStreaming(threadId: string, messageId: string): boolean {
  const states = get(streamStates);
  const state = states[threadId];
  return !!state && state.messageId === messageId && state.isStreaming;
}

// Get the current partial content for a specific thread
export function getPartialContent(threadId: string): string | null {
  const states = get(streamStates);
  return states[threadId]?.partialContent || null;
}

// Get the context messages for resuming for a specific thread
export function getContextMessages(threadId: string): StreamContextMessage[] | null {
  const states = get(streamStates);
  return states[threadId]?.contextMessages || null;
}

// Get the entire stream state for a specific thread
export function getStreamState(threadId: string): StreamState | null {
  const states = get(streamStates);
  return states[threadId] || null;
}
