import { browser } from '$app/environment';
import { get, writable, type Writable } from 'svelte/store';
import type { StreamContextMessage, StreamState } from './types';

// Prefix for individual stream state entries in localStorage
const STREAM_STATE_PREFIX = 'streamState.'; // final key will be `${STREAM_STATE_PREFIX}${messageId}`

/**
 * Saves a single stream state to localStorage.
 */
function persistState(state: StreamState) {
  try {
    localStorage.setItem(`${STREAM_STATE_PREFIX}${state.messageId}`, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to persist stream state', err);
  }
}

/**
 * Removes a single stream state from localStorage by messageId.
 */
function removePersistedState(messageId: string) {
  try {
    localStorage.removeItem(`${STREAM_STATE_PREFIX}${messageId}`);
  } catch (err) {
    console.warn('Failed to remove persisted stream state', err);
  }
}

// Store for multiple stream states, indexed by chatId
export const streamStates: Writable<Record<string, StreamState>> = writable({});

// Initialize from localStorage if available
if (browser) {
  try {
    // Reconstruct states from individual keys
    const reconstructed: Record<string, StreamState> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STREAM_STATE_PREFIX)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const state: StreamState = JSON.parse(raw);
        // Ensure fallbacks for optional props
        state.partialContent ||= '';
        state.partialReasoning ||= '';
        state.contextMessages ||= [];

        reconstructed[state.chatId] = state;
      } catch (err) {
        console.warn('Failed to parse persisted stream state', key, err);
        localStorage.removeItem(key); // corrupt entry cleanup
      }
    }

    if (Object.keys(reconstructed).length > 0) {
      streamStates.set(reconstructed);
    }
  } catch (error) {
    console.error('Error loading stream states:', error);
  }
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

    // Persist immediately
    persistState(states[chatId]);
    return states;
  });
}

export function updateStreamContent(chatId: string, content: string): void {
  streamStates.update((states) => {
    if (states[chatId]) {
      states[chatId].partialContent = content;

      // Persist incremental content
      persistState(states[chatId]);
    }
    return states;
  });
}

export function updateStreamReasoning(chatId: string, reasoning: string): void {
  streamStates.update((states) => {
    if (states[chatId]) {
      states[chatId].partialReasoning = reasoning;

      // Persist incremental reasoning
      persistState(states[chatId]);
    }
    return states;
  });
}

export function endStream(chatId: string): void {
  streamStates.update((states) => {
    const state = states[chatId];
    if (state) {
      removePersistedState(state.messageId);
    }
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
