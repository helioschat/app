<script lang="ts">
  import { authState, syncManager, syncSettings } from '$lib/stores/sync';
  import WalletGenerateModal from '$lib/components/modal/types/WalletGenerateModal.svelte';
  import WalletSaveModal from '$lib/components/modal/types/WalletSaveModal.svelte';
  import SyncLoginModal from '$lib/components/modal/types/SyncLoginModal.svelte';

  let showGenerateModal = $state(false);
  let showSaveModal = $state(false);
  let showLoginModal = $state(false);

  let walletCredentials = $state<{
    userId: string;
    passphrase: string;
    createdAt: string;
    serverUrl: string;
  } | null>(null);

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
    if (
      !confirm(
        'Are you sure you want to logout? You will need to login using your wallet credentials to access your Sync Wallet again.',
      )
    ) {
      return;
    }
    syncManager.logout();
  }
</script>

<div class="panel">
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      {#if $authState.isAuthenticated}
        <div class="h-2 w-2 rounded-full bg-green-500"></div>
        <span class="text-sm font-medium text-green-400">Connected</span>
      {:else}
        <div class="h-2 w-2 rounded-full bg-gray-500"></div>
        <span class="text-sm font-medium text-gray-400">Not Connected</span>
      {/if}
    </div>

    <div class="space-y-1 text-sm text-gray-400">
      <div>
        <span class="font-semibold">Server:</span> <span>{$syncSettings.serverUrl ?? $authState.serverUrl}</span>
      </div>
      <div><span class="font-semibold">User ID:</span> <span>{$syncSettings.userId ?? $authState.userId}</span></div>
    </div>

    {#if $authState.isAuthenticated}
      <div class="flex flex-wrap gap-2">
        <button class="button button-secondary" onclick={handleLogout}> Logout </button>
      </div>
    {/if}
  </div>
</div>

{#if !$authState.isAuthenticated}
  <div class="panel">
    <h3 class="text-xl font-bold">Setup Sync</h3>

    <p class="text-secondary text-sm">
      Sync allows you to access your chat history across multiple devices. Your data is encrypted client-side before
      being sent to the server.
    </p>

    <div class="mt-2 flex gap-2">
      <button class="button button-primary" onclick={openGenerateModal}> Generate New Wallet </button>
      <button class="button button-secondary" onclick={openLoginModal}> Login with Existing Wallet </button>
    </div>
  </div>
{/if}

<WalletGenerateModal
  id="wallet-generate"
  isOpen={showGenerateModal}
  on:close={() => (showGenerateModal = false)}
  on:success={handleWalletGenerated}></WalletGenerateModal>

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
    on:login={handleAutoLogin}></WalletSaveModal>
{/if}

<SyncLoginModal
  id="sync-login"
  isOpen={showLoginModal}
  on:close={() => (showLoginModal = false)}
  on:success={handleLoginSuccess}></SyncLoginModal>
