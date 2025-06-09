import type { ComponentType, SvelteComponent } from 'svelte';
import { writable } from 'svelte/store';

export interface ModalConfig {
  id: string;
  component: ComponentType<SvelteComponent>;
  props?: Record<string, unknown>;
}

function createModalStore() {
  const { subscribe, set, update } = writable<ModalConfig[]>([]);

  return {
    subscribe,
    open: (config: ModalConfig) => update((modals) => [...modals, config]),
    close: (id: string) => update((modals) => modals.filter((modal) => modal.id !== id)),
    closeAll: () => set([]),
  };
}

export const modalStore = createModalStore();
