import { writable } from 'svelte/store';

interface ScrollState {
  shouldAutoScroll: boolean;
}

function createScrollStore() {
  const { subscribe, set, update } = writable<ScrollState>({
    shouldAutoScroll: true,
  });

  return {
    subscribe,
    disableAutoScroll: () => update((state) => ({ ...state, shouldAutoScroll: false })),
    enableAutoScroll: () => update((state) => ({ ...state, shouldAutoScroll: true })),
    reset: () => set({ shouldAutoScroll: true }),
  };
}

export const scrollState = createScrollStore();
