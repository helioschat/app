<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';

  export let id: string;
  export let isOpen = false;
  /** The current name to pre-fill in the input (pass empty string for a new folder). */
  export let initialName = '';

  let inputValue = '';

  // Sync inputValue whenever the modal opens or initialName changes
  $: if (isOpen) {
    inputValue = initialName;
  }

  const dispatch = createEventDispatcher<{
    confirm: { name: string };
    cancel: void;
  }>();

  function handleConfirm() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    dispatch('confirm', { name: trimmed });
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleConfirm();
    }
  }
</script>

<Modal
  {id}
  title={initialName ? 'Rename Folder' : 'New Folder'}
  {isOpen}
  hideCloseButton
  smallWidth
  on:close={handleCancel}>
  <input
    type="text"
    class="input w-full"
    placeholder="Folder name"
    bind:value={inputValue}
    on:keydown={handleKeydown}
    autofocus />

  <svelte:fragment slot="footer">
    <button type="button" class="button button-secondary" on:click={handleCancel}> Cancel </button>
    <button type="button" class="button button-primary" disabled={!inputValue.trim()} on:click={handleConfirm}>
      {initialName ? 'Rename' : 'Create'}
    </button>
  </svelte:fragment>
</Modal>
