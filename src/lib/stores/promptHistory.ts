import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const PROMPT_HISTORY_KEY = 'promptHistory';
const MAX_HISTORY_SIZE = 100;

interface PromptHistoryState {
  prompts: string[];
  currentIndex: number;
  currentDraft: string; // Store the unsent text when navigating
}

function getInitialPromptHistory(): PromptHistoryState {
  if (!browser) {
    return { prompts: [], currentIndex: -1, currentDraft: '' };
  }

  try {
    const stored = sessionStorage.getItem(PROMPT_HISTORY_KEY);
    if (stored) {
      const prompts = JSON.parse(stored) as string[];
      return { prompts, currentIndex: -1, currentDraft: '' };
    }
  } catch (error) {
    console.warn('Failed to load prompt history from session storage:', error);
  }

  return { prompts: [], currentIndex: -1, currentDraft: '' };
}

function saveToSessionStorage(prompts: string[]): void {
  if (!browser) return;

  try {
    sessionStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(prompts));
  } catch (error) {
    console.warn('Failed to save prompt history to session storage:', error);
  }
}

const { subscribe, update } = writable<PromptHistoryState>(getInitialPromptHistory());

export const promptHistory = {
  subscribe,

  /**
   * Add a new prompt to the history
   * @param prompt The prompt to add
   */
  addPrompt: (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    update((state) => {
      // Remove the prompt if it already exists to avoid duplicates
      const filteredPrompts = state.prompts.filter((p) => p !== trimmedPrompt);

      // Add the new prompt to the beginning
      const newPrompts = [trimmedPrompt, ...filteredPrompts];

      // Limit the history size
      if (newPrompts.length > MAX_HISTORY_SIZE) {
        newPrompts.splice(MAX_HISTORY_SIZE);
      }

      // Save to session storage
      saveToSessionStorage(newPrompts);

      return {
        prompts: newPrompts,
        currentIndex: -1, // Reset navigation index
        currentDraft: '', // Clear the draft
      };
    });
  },

  /**
   * Navigate to the previous prompt in history
   * @param currentText The current unsent text to save before navigating
   * @returns The previous prompt or null if at the end
   */
  navigatePrevious: (currentText?: string): string | null => {
    let result: string | null = null;

    update((state) => {
      if (state.prompts.length === 0) return state;

      // Save the current draft if this is the first navigation
      const draft = state.currentIndex === -1 && currentText !== undefined ? currentText : state.currentDraft;

      const newIndex = Math.min(state.currentIndex + 1, state.prompts.length - 1);
      result = state.prompts[newIndex] || null;

      return {
        ...state,
        currentIndex: newIndex,
        currentDraft: draft,
      };
    });

    return result;
  },

  /**
   * Navigate to the next prompt in history
   * @returns The next prompt, current draft if at the beginning, or empty string
   */
  navigateNext: (): string | null => {
    let result: string | null = null;

    update((state) => {
      if (state.prompts.length === 0) return state;

      const newIndex = Math.max(state.currentIndex - 1, -1);
      result = newIndex === -1 ? state.currentDraft : state.prompts[newIndex] || '';

      return {
        ...state,
        currentIndex: newIndex,
      };
    });

    return result;
  },

  /**
   * Reset the navigation index (call when user starts typing)
   */
  resetNavigation: () => {
    update((state) => ({
      ...state,
      currentIndex: -1,
      currentDraft: '',
    }));
  },

  /**
   * Clear all prompt history
   */
  clear: () => {
    if (browser) {
      sessionStorage.removeItem(PROMPT_HISTORY_KEY);
    }
    update(() => ({ prompts: [], currentIndex: -1, currentDraft: '' }));
  },
};
