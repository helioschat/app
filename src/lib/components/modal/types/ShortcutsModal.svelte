<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import type { ShortcutRegistry } from '$lib/stores/shortcuts';
  import { formatShortcut, groupShortcuts } from '$lib/stores/shortcuts';

  export let id: string;
  export let isOpen = false;
  export let shortcuts: ShortcutRegistry;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function handleClose() {
    dispatch('close');
  }

  // Group shortcuts by category
  $: shortcutGroups = groupShortcuts(shortcuts);
</script>

<Modal {id} title="Keyboard Shortcuts" {isOpen} on:close={handleClose}>
  <div class="space-y-6">
    {#each shortcutGroups as group}
      <div>
        <h3 class="mb-3 text-sm font-semibold tracking-wide text-[var(--color-a11)] uppercase">{group.category}</h3>
        <div class="space-y-2">
          {#each group.shortcuts as [_key, shortcut]}
            <div class="flex items-center justify-between rounded-lg bg-[var(--color-a2)] px-4 py-2.5">
              <span class="text-sm">{shortcut.description}</span>
              <kbd
                class="rounded border border-b-4 border-[var(--color-a6)] bg-[var(--color-a3)] px-1 py-0.5 font-sans text-xs font-semibold text-[var(--color-a12)]"
                >{formatShortcut(shortcut)}</kbd>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</Modal>
