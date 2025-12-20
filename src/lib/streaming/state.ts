import { get, writable, type Writable } from 'svelte/store';
import type { StreamContextMessage, StreamState } from './types';

// Store for multiple stream states, indexed by chatId
export const streamStates: Writable<Record<string, StreamState>> = writable({});

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
