import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const PROMPT_HISTORY_KEY = 'promptHistory';
const MAX_HISTORY_SIZE = 100;

interface PromptHistoryState {
  prompts: string[];
  currentIndex: number;
}

function getInitialPromptHistory(): PromptHistoryState {
  if (!browser) {
    return { prompts: [], currentIndex: -1 };
  }

  try {
    const stored = sessionStorage.getItem(PROMPT_HISTORY_KEY);
    if (stored) {
      const prompts = JSON.parse(stored) as string[];
      return { prompts, currentIndex: -1 };
    }
  } catch (error) {
    console.warn('Failed to load prompt history from session storage:', error);
  }

  return { prompts: [], currentIndex: -1 };
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
      };
    });
  },

  /**
   * Navigate to the previous prompt in history
   * @returns The previous prompt or null if at the end
   */
  navigatePrevious: (): string | null => {
    let result: string | null = null;

    update((state) => {
      if (state.prompts.length === 0) return state;

      const newIndex = Math.min(state.currentIndex + 1, state.prompts.length - 1);
      result = state.prompts[newIndex] || null;

      return {
        ...state,
        currentIndex: newIndex,
      };
    });

    return result;
  },

  /**
   * Navigate to the next prompt in history
   * @returns The next prompt or empty string if at the beginning
   */
  navigateNext: (): string | null => {
    let result: string | null = null;

    update((state) => {
      if (state.prompts.length === 0) return state;

      const newIndex = Math.max(state.currentIndex - 1, -1);
      result = newIndex === -1 ? '' : state.prompts[newIndex] || '';

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
    }));
  },

  /**
   * Clear all prompt history
   */
  clear: () => {
    if (browser) {
      sessionStorage.removeItem(PROMPT_HISTORY_KEY);
    }
    update(() => ({ prompts: [], currentIndex: -1 }));
  },
};
