<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import { syncManager } from '$lib/stores/sync';
  import Alert from '$lib/components/common/Alert.svelte';

  export let id: string;
  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: { id: string };
    success: { userId: string; passphrase: string; createdAt: string; serverUrl: string };
  }>();

  let serverUrl = 'https://theia.heliosch.at';
  let passphrase = '';
  let confirmPassphrase = '';
  let isLoading = false;
  let error = '';

  $: passphraseMatch = passphrase === confirmPassphrase;
  $: canGenerate = serverUrl.trim() && passphrase.length >= 8 && passphraseMatch && !isLoading;

  function close() {
    dispatch('close', { id });
    resetForm();
  }

  function resetForm() {
    serverUrl = 'https://theia.heliosch.at';
    passphrase = '';
    confirmPassphrase = '';
    error = '';
    isLoading = false;
  }

  async function handleGenerate() {
    if (!canGenerate) return;

    isLoading = true;
    error = '';

    try {
      const result = await syncManager.generateWallet(serverUrl.trim(), passphrase);
      dispatch('success', {
        userId: result.userId,
        passphrase,
        createdAt: result.createdAt,
        serverUrl: serverUrl.trim(),
      });
      resetForm();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to generate wallet';
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && canGenerate) {
      handleGenerate();
    }
  }
</script>

<Modal {id} title="Generate Sync Wallet" {isOpen} on:close={close}>
  <div class="space-y-4">
    {#if error}
      <Alert type="error" title="Error">{error}</Alert>
    {/if}

    <Alert type="warning" title="Important Notice">
      Keep your passphrase safe! It cannot be recovered if lost. You'll need both your User ID and passphrase to access
      your synced data.
    </Alert>

    <div>
      <label for="server-url" class="mb-1 block text-sm font-medium"> Sync Server URL </label>
      <input
        id="server-url"
        type="url"
        bind:value={serverUrl}
        placeholder="https://your-sync-server.com"
        class="w-full"
        disabled={isLoading}
        on:keydown={handleKeydown} />
    </div>

    <div>
      <label for="passphrase" class="mb-1 block text-sm font-medium"> Passphrase (minimum 8 characters) </label>
      <input
        id="passphrase"
        type="password"
        bind:value={passphrase}
        placeholder="Enter a strong passphrase"
        class="w-full"
        disabled={isLoading}
        on:keydown={handleKeydown} />
    </div>

    <div>
      <label for="confirm-passphrase" class="mb-1 block text-sm font-medium"> Confirm Passphrase </label>
      <input
        id="confirm-passphrase"
        type="password"
        bind:value={confirmPassphrase}
        placeholder="Confirm your passphrase"
        class="w-full"
        class:error={confirmPassphrase && !passphraseMatch}
        disabled={isLoading}
        on:keydown={handleKeydown} />
      {#if confirmPassphrase && !passphraseMatch}
        <p class="mt-1 text-sm text-red-500">Passphrases do not match</p>
      {/if}
    </div>
  </div>

  <svelte:fragment slot="footer">
    <button type="button" class="button button-secondary" on:click={close} disabled={isLoading}> Cancel </button>
    <button type="button" class="button button-primary" disabled={!canGenerate} on:click={handleGenerate}>
      {#if isLoading}
        Generating...
      {:else}
        Generate Wallet
      {/if}
    </button>
  </svelte:fragment>
</Modal>
