<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import Portal from './Portal.svelte';

  export let id: string;
  export let title: string;
  export let isOpen = false;
  export let closeOnClickOutside = true;

  const dispatch = createEventDispatcher<{
    close: { id: string };
  }>();

  let dialog: HTMLDialogElement;
  let previousActiveElement: HTMLElement | null = null;

  function close() {
    dispatch('close', { id });
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (closeOnClickOutside && dialog && !dialog.contains(target)) {
      close();
    }
  }

  onMount(() => {
    if (isOpen) {
      previousActiveElement = document.activeElement as HTMLElement;
    }

    return () => {
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  });
</script>

{#if isOpen}
  <Portal>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto p-4"
      transition:fade={{ duration: 200, easing: quintOut }}
      on:click={handleClickOutside}>
      <div class="fixed inset-0 bg-black/75" aria-hidden="true"></div>

      <dialog
        bind:this={dialog}
        class="relative mx-auto w-full max-w-lg rounded-lg p-6"
        aria-labelledby={`${id}-title`}
        aria-modal="true"
        open
        transition:scale={{ duration: 200, easing: quintOut, start: 0.9 }}>
        <div class="flex flex-col">
          <div class="flex items-center justify-between">
            <h2 id={`${id}-title`} class="text-lg font-bold">
              {title}
            </h2>
            <button type="button" class="button button-secondary h-8 w-8" aria-label="Close modal" on:click={close}>
              ✕
            </button>
          </div>

          <div class="mt-2">
            <slot></slot>
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <slot name="footer"></slot>
          </div>
        </div>
      </dialog>
    </div>
  </Portal>
{/if}

<style lang="postcss">
  dialog {
    background-color: var(--color-2);
    color: var(--color-12);

    &::backdrop {
      display: none;
    }
  }
</style>
