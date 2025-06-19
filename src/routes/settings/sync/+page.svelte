<script lang="ts">
  import { authState, syncManager, syncSettings } from '$lib/stores/sync';
  import { isAutoSyncEnabled } from '$lib/sync';
  import WalletGenerateModal from '$lib/components/modal/types/WalletGenerateModal.svelte';
  import WalletSaveModal from '$lib/components/modal/types/WalletSaveModal.svelte';
  import SyncLoginModal from '$lib/components/modal/types/SyncLoginModal.svelte';
  import Alert from '$lib/components/common/Alert.svelte';

  let showGenerateModal = $state(false);
  let showSaveModal = $state(false);
  let showLoginModal = $state(false);
  let autoSyncEnabled = $state(isAutoSyncEnabled());

  let walletCredentials = $state<{
    userId: string;
    passphrase: string;
    createdAt: string;
    serverUrl: string;
  } | null>(null);

  // Update auto-sync state when auth state changes
  $effect(() => {
    autoSyncEnabled = isAutoSyncEnabled();
  });

  function openGenerateModal() {
    showGenerateModal = true;
  }

  function openLoginModal() {
    showLoginModal = true;
  }

  function handleWalletGenerated(event: CustomEvent) {
    const { userId, passphrase, createdAt, serverUrl } = event.detail;
    walletCredentials = { userId, passphrase, createdAt, serverUrl };
    showGenerateModal = false;
    showSaveModal = true;
  }

  function handleLoginSuccess() {
    showLoginModal = false;
  }

  async function handleAutoLogin(event: CustomEvent) {
    const { serverUrl, userId, passphrase } = event.detail;

    try {
      await syncManager.login(serverUrl, userId, passphrase);
      showSaveModal = false;
      walletCredentials = null;
    } catch (err) {
      console.error('Auto-login failed:', err);
      // If auto-login fails, just close the modal - user can manually login later
      showSaveModal = false;
      walletCredentials = null;
    }
  }

  function handleLogout() {
    syncManager.logout();
  }
</script>

<div class="space-y-6">
  <!-- Connection Status -->
  <div class="card p-4">
    <h3 class="mb-3 text-lg font-medium">Connection Status</h3>

    {#if $authState.isAuthenticated}
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-green-500"></div>
          <span class="text-sm font-medium text-green-400">Connected</span>
        </div>

        <div class="space-y-1 text-sm text-gray-400">
          <div><strong>Server:</strong> {$authState.serverUrl}</div>
          <div><strong>User ID:</strong> <code class="font-mono text-xs">{$authState.userId}</code></div>
        </div>

        <div class="mt-3 flex gap-2">
          <button class="button button-secondary" on:click={handleLogout}> Logout </button>
        </div>
      </div>
    {:else}
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-gray-500"></div>
          <span class="text-sm font-medium text-gray-400">Not Connected</span>
        </div>

        {#if $syncSettings.serverUrl}
          <div class="text-sm text-gray-400">
            <div><strong>Server:</strong> {$syncSettings.serverUrl}</div>
            {#if $syncSettings.userId}
              <div><strong>User ID:</strong> <code class="font-mono text-xs">{$syncSettings.userId}</code></div>
            {/if}
          </div>
        {:else}
          <p class="text-sm text-gray-400">No sync configuration found.</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Setup Section -->
  {#if !$authState.isAuthenticated}
    <div class="card p-4">
      <h3 class="mb-3 text-lg font-medium">Setup Sync</h3>

      <div class="space-y-4">
        <Alert type="info"
          >Sync allows you to access your chat history across multiple devices. Your data is encrypted client-side
          before being sent to the server.</Alert>

        <div class="flex gap-2">
          <button class="button button-primary" on:click={openGenerateModal}> Generate New Wallet </button>
          <button class="button button-secondary" on:click={openLoginModal}> Login with Existing Wallet </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Modals -->
<WalletGenerateModal
  id="wallet-generate"
  isOpen={showGenerateModal}
  on:close={() => (showGenerateModal = false)}
  on:success={handleWalletGenerated} />

{#if walletCredentials}
  <WalletSaveModal
    id="wallet-save"
    isOpen={showSaveModal}
    userId={walletCredentials.userId}
    passphrase={walletCredentials.passphrase}
    createdAt={walletCredentials.createdAt}
    serverUrl={walletCredentials.serverUrl}
    on:close={() => {
      showSaveModal = false;
      walletCredentials = null;
    }}
    on:login={handleAutoLogin} />
{/if}

<SyncLoginModal
  id="sync-login"
  isOpen={showLoginModal}
  on:close={() => (showLoginModal = false)}
  on:success={handleLoginSuccess} />

<style lang="postcss">
  .card {
    background-color: var(--color-2);
    border: 1px solid var(--color-6);
    border-radius: 8px;
  }
</style>
