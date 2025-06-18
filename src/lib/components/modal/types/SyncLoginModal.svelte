<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import { syncManager } from '$lib/stores/sync';
  import Alert from '$lib/components/common/Alert.svelte';

  export let id: string;
  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: { id: string };
    success: void;
  }>();

  let serverUrl = 'https://theia.heliosch.at';
  let userId = '';
  let passphrase = '';
  let isLoading = false;
  let error = '';
  let fileInput: HTMLInputElement;
  let isAutoLogin = false;

  $: canLogin = serverUrl.trim() && userId.trim() && passphrase.trim() && !isLoading;

  function close() {
    dispatch('close', { id });
    resetForm();
  }

  function resetForm() {
    serverUrl = 'https://theia.heliosch.at';
    userId = '';
    passphrase = '';
    error = '';
    isLoading = false;
    isAutoLogin = false;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  async function handleLogin() {
    if (!canLogin) return;

    isLoading = true;
    isAutoLogin = false;
    error = '';

    try {
      await syncManager.login(serverUrl.trim(), userId.trim(), passphrase);
      dispatch('success');
      resetForm();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed';
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && canLogin) {
      handleLogin();
    }
  }

  function handleFileUpload() {
    fileInput.click();
  }

  async function handleFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const credentials = JSON.parse(content);

        if (credentials.userId && credentials.passphrase) {
          userId = credentials.userId;
          passphrase = credentials.passphrase;
          // Try to extract server URL from the file if it exists
          if (credentials.serverUrl) {
            serverUrl = credentials.serverUrl;
          }
          error = '';

          // Auto-login after successfully parsing the file
          if (serverUrl.trim() && userId.trim() && passphrase.trim()) {
            await attemptAutoLogin();
          }
        } else {
          error = 'Invalid credentials file format';
        }
      } catch (err) {
        error = 'Failed to parse credentials file';
      }
    };

    reader.readAsText(file);
  }

  async function attemptAutoLogin() {
    isLoading = true;
    isAutoLogin = true;
    error = '';

    try {
      await syncManager.login(serverUrl.trim(), userId.trim(), passphrase);
      dispatch('success');
      resetForm();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Auto-login failed. Please check your credentials and try again.';
      // Don't reset the form on auto-login failure so user can manually retry
    } finally {
      isLoading = false;
      isAutoLogin = false;
    }
  }
</script>

<Modal {id} title="Login to Sync" {isOpen} on:close={close}>
  <div class="space-y-4">
    {#if error}
      <Alert type="error" title="Error">{error}</Alert>
    {/if}

    <!-- File Upload Section -->
    <Alert type="info" title="Quick Login with Backup File">
      Upload your downloaded credentials file to automatically fill in the fields and attempt login.
      <div class="mt-2">
        <button class="button button-primary" on:click={handleFileUpload} disabled={isLoading}>
          {#if isLoading}
            Processing...
          {:else}
            Upload Credentials File
          {/if}
        </button>
      </div>
      <input bind:this={fileInput} type="file" accept=".json" class="hidden" on:change={handleFileSelected} />
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
      <label for="user-id" class="mb-1 block text-sm font-medium"> User ID </label>
      <input
        id="user-id"
        type="text"
        bind:value={userId}
        placeholder="Your wallet User ID"
        class="w-full"
        disabled={isLoading}
        on:keydown={handleKeydown} />
    </div>

    <div>
      <label for="passphrase" class="mb-1 block text-sm font-medium"> Passphrase </label>
      <input
        id="passphrase"
        type="password"
        bind:value={passphrase}
        placeholder="Your wallet passphrase"
        class="w-full"
        disabled={isLoading}
        on:keydown={handleKeydown} />
    </div>
  </div>

  <svelte:fragment slot="footer">
    <button type="button" class="button button-secondary" on:click={close} disabled={isLoading}> Cancel </button>
    <button type="button" class="button button-primary" disabled={!canLogin} on:click={handleLogin}>
      {#if isLoading}
        {#if isAutoLogin}
          Auto-logging in...
        {:else}
          Logging in...
        {/if}
      {:else}
        Login
      {/if}
    </button>
  </svelte:fragment>
</Modal>
