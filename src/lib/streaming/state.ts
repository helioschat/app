import { browser } from '$app/environment';
import { get, writable, type Writable } from 'svelte/store';
import type { StreamContextMessage, StreamState } from './types';

const STREAM_STATE_KEY = 'llmchat-stream-states';

// Store for multiple stream states, indexed by chatId
export const streamStates: Writable<Record<string, StreamState>> = writable({});

// Initialize from localStorage if available
if (browser) {
  try {
    const savedStates = localStorage.getItem(STREAM_STATE_KEY);
    if (savedStates) {
      const parsedStates = JSON.parse(savedStates);
      if (typeof parsedStates === 'object' && parsedStates !== null) {
        // Ensure all required properties exist
        for (const chatId in parsedStates) {
          const state = parsedStates[chatId];
          if (!state.partialContent) state.partialContent = '';
          if (!state.partialReasoning) state.partialReasoning = '';
          if (!state.contextMessages) state.contextMessages = [];
        }
        streamStates.set(parsedStates);
      }
    }
  } catch (error) {
    console.error('Error loading stream states:', error);
  }

  // Save to localStorage when states change
  streamStates.subscribe((states) => {
    if (Object.keys(states).length > 0) {
      localStorage.setItem(STREAM_STATE_KEY, JSON.stringify(states));
    } else {
      localStorage.removeItem(STREAM_STATE_KEY);
    }
  });
}

export function startStream(chatId: string, messageId: string, contextMessages: StreamContextMessage[]): void {
  streamStates.update((states) => {
    states[chatId] = {
      chatId,
      messageId,
      isStreaming: true,
      startTime: Date.now(),
      partialContent: '',
      partialReasoning: '',
      contextMessages,
    };
    return states;
  });
}

export function updateStreamContent(chatId: string, content: string): void {
  streamStates.update((states) => {
    if (states[chatId]) {
      states[chatId].partialContent = content;
    }
    return states;
  });
}

export function updateStreamReasoning(chatId: string, reasoning: string): void {
  streamStates.update((states) => {
    if (states[chatId]) {
      states[chatId].partialReasoning = reasoning;
    }
    return states;
  });
}

export function endStream(chatId: string): void {
  streamStates.update((states) => {
    delete states[chatId];
    return states;
  });
}

export function isMessageStreaming(chatId: string, messageId: string): boolean {
  const states = get(streamStates);
  const state = states[chatId];
  return !!state && state.messageId === messageId && state.isStreaming;
}

export function getPartialContent(chatId: string): string | null {
  const states = get(streamStates);
  return states[chatId]?.partialContent || null;
}

export function getPartialReasoning(chatId: string): string | null {
  const states = get(streamStates);
  return states[chatId]?.partialReasoning || null;
}

export function getContextMessages(chatId: string): StreamContextMessage[] | null {
  const states = get(streamStates);
  return states[chatId]?.contextMessages || null;
}

export function getStreamState(chatId: string): StreamState | null {
  const states = get(streamStates);
  return states[chatId] || null;
}
