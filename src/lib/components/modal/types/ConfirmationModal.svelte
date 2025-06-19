<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';

  export let id: string;
  export let title: string = 'Confirm Action';
  export let message: string;
  export let confirmText: string = 'Confirm';
  export let cancelText: string = 'Cancel';
  export let isOpen = false;
  export let isDangerous = false;

  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
  }>();

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<Modal {id} {title} {isOpen} hideCloseButton smallWidth on:close={handleCancel}>
  <p class="text-secondary text-sm">{message}</p>

  <svelte:fragment slot="footer">
    <button type="button" class="button button-secondary" on:click={handleCancel}>
      {cancelText}
    </button>
    <button
      type="button"
      class="button"
      class:button-primary={!isDangerous}
      class:button-danger={isDangerous}
      on:click={handleConfirm}>
      {confirmText}
    </button>
  </svelte:fragment>
</Modal>
