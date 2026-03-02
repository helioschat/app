import { browser } from '$app/environment';
import { personalizationSettings, settingsManager } from '$lib/settings/SettingsManager';
import type { Chat, MessageWithAttachments } from '$lib/types';
import { get, writable } from 'svelte/store';

export interface ToggleState {
  webSearchEnabled: boolean;
  webSearchContextSize: 'low' | 'medium' | 'high';
  reasoningEnabled: boolean;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  reasoningSummary: 'auto' | 'concise' | 'detailed';
  toolUseEnabled: boolean;
  memoryEnabled: boolean;
}

const STORAGE_KEY = 'toggleState';

function getDefaultsFromPersonalization(): ToggleState {
  const p = get(personalizationSettings);
  return {
    webSearchEnabled: p.defaultWebSearchEnabled,
    webSearchContextSize: p.defaultWebSearchContextSize,
    reasoningEnabled: p.defaultReasoningEnabled,
    reasoningEffort: p.defaultReasoningEffort,
    reasoningSummary: p.defaultReasoningSummary,
    toolUseEnabled: p.defaultToolUseEnabled,
    memoryEnabled: p.defaultMemoryEnabled,
  };
}

function getInitialToggleState(): ToggleState {
  if (browser) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<ToggleState>;
        // Merge with defaults so any new fields are populated
        return { ...getDefaultsFromPersonalization(), ...parsed };
      } catch {
        // fall through to defaults
      }
    }
  }
  return getDefaultsFromPersonalization();
}

export const toggleStore = writable<ToggleState>(getInitialToggleState());

// Persist every change to localStorage
if (browser) {
  toggleStore.subscribe((value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  });
}

/**
 * Resets the toggle store to the user's configured defaults from PersonalizationSettings.
 */
export function resetTogglesToDefaults(): void {
  toggleStore.set(getDefaultsFromPersonalization());
}

/**
 * Overwrites the toggle store with the last-used toggle values saved on a Chat.
 * Falls back to current values for any field not stored on the chat.
 */
export function restoreTogglesFromChat(chat: Chat): void {
  toggleStore.update((current) => ({
    webSearchEnabled: chat.webSearchEnabled ?? current.webSearchEnabled,
    webSearchContextSize: chat.webSearchContextSize ?? current.webSearchContextSize,
    reasoningEnabled: chat.reasoningEnabled ?? current.reasoningEnabled,
    reasoningEffort: chat.reasoningEffort ?? current.reasoningEffort,
    reasoningSummary: chat.reasoningSummary ?? current.reasoningSummary,
    toolUseEnabled: chat.toolUseEnabled ?? current.toolUseEnabled,
    memoryEnabled: chat.memoryEnabled ?? current.memoryEnabled,
  }));
}

/**
 * Temporarily restores toggle state from a specific user message (for edit mode).
 * Returns the previous state so the caller can restore it when editing is cancelled.
 */
export function restoreTogglesFromMessage(message: MessageWithAttachments): ToggleState {
  const previous = get(toggleStore);
  toggleStore.update((current) => ({
    webSearchEnabled: message.webSearchEnabled ?? current.webSearchEnabled,
    webSearchContextSize: message.webSearchContextSize ?? current.webSearchContextSize,
    reasoningEnabled: message.reasoningEnabled ?? current.reasoningEnabled,
    reasoningEffort: message.reasoningEffort ?? current.reasoningEffort,
    reasoningSummary: message.reasoningSummary ?? current.reasoningSummary,
    toolUseEnabled: message.toolUseEnabled ?? current.toolUseEnabled,
    memoryEnabled: message.memoryEnabled ?? current.memoryEnabled,
  }));
  return previous;
}

// Re-export settingsManager so callers don't need a second import just for personalizationSettings
export { settingsManager };
