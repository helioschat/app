<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import Portal from './Portal.svelte';

  export let id: string;
  export let title: string;
  export let isOpen = false;
  export let closeOnClickOutside = true;
  export let hideCloseButton = false;
  export let smallWidth = false;

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
      <div class="fixed inset-0 bg-black/25 backdrop-blur-xs" aria-hidden="true"></div>

      <dialog
        bind:this={dialog}
        class="relative mx-auto w-full max-w-lg rounded-2xl shadow-lg lg:max-w-2xl"
        class:small-width={smallWidth}
        aria-labelledby={`${id}-title`}
        data-modal
        aria-modal="true"
        open
        transition:scale={{ duration: 200, easing: quintOut, start: 0.9 }}>
        <div class="flex flex-col">
          <div class="flex items-center justify-between py-3 ps-4 pe-2">
            <h2 id={`${id}-title`} class="text-lg font-medium">
              {title}
            </h2>
            <button
              type="button"
              class="button button-ghost button-circle modal-close-btn"
              class:!hidden={hideCloseButton}
              class:!pointer-events-none={!hideCloseButton}
              inert={hideCloseButton}
              aria-label="Close modal"
              on:click={close}>
              ✕
            </button>
          </div>

          <div class="grow overflow-y-auto p-4 pt-1">
            <div>
              <slot></slot>
            </div>

            <div class="flex justify-end gap-2 not-empty:mt-4">
              <slot name="footer"></slot>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  </Portal>
{/if}

<style lang="postcss">
  @reference "tailwindcss";

  dialog {
    background-color: var(--color-2);
    color: var(--color-12);

    &.small-width {
      @apply max-w-md lg:max-w-md;
    }

    &::backdrop {
      display: none;
    }
  }
</style>
