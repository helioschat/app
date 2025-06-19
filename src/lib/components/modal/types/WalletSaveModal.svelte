<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import Alert from '$lib/components/common/Alert.svelte';
  import { Download } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';

  export let id: string;
  export let isOpen = false;
  export let userId: string;
  export let passphrase: string;
  export let createdAt: string;
  export let serverUrl: string;

  const dispatch = createEventDispatcher<{
    close: { id: string };
    login: { serverUrl: string; userId: string; passphrase: string };
  }>();

  function close() {
    dispatch('close', { id });
  }

  function handleSavedAndLogin() {
    dispatch('login', { serverUrl, userId, passphrase });
    dispatch('close', { id });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }

  function downloadCredentials() {
    const credentials = {
      userId,
      passphrase,
      serverUrl,
      createdAt,
      note: 'Keep these credentials safe! You will need the User ID, passphrase, and server URL to access your synced data.',
    };

    const blob = new Blob([JSON.stringify(credentials, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `llmchat-sync-credentials-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<Modal {id} title="Wallet Generated Successfully" {isOpen} closeOnClickOutside={false} on:close={close}>
  <div class="space-y-4">
    <Alert type="success" title="Your sync wallet has been generated successfully!">
      Please save these credentials in a secure location.
    </Alert>

    <Alert type="warning" title="Important Security Notice">
      • Keep these credentials safe and secure
      <br />
      • Your passphrase cannot be recovered if lost
      <br />
      • Do not share these credentials with anyone
      <br />
      • Consider using a password manager to store them
      <br />
      • The downloaded file can be used for quick login on other devices
    </Alert>

    <button class="button button-primary w-full" on:click={downloadCredentials}>
      <Download size={16}></Download> Download as File
    </button>

    <div class="space-y-3">
      <div>
        <label for="user-id-display" class="mb-1 block text-sm font-medium">User ID</label>
        <div class="flex gap-2">
          <input id="user-id-display" type="text" value={userId} class="input flex-1" readonly />
          <button type="button" class="button button-secondary button-action" on:click={() => copyToClipboard(userId)}>
            Copy
          </button>
        </div>
      </div>

      <div>
        <label for="passphrase-display" class="mb-1 block text-sm font-medium">Passphrase</label>
        <div class="flex gap-2">
          <input id="passphrase-display" type="password" value={passphrase} class="flex-1" readonly />
          <button
            type="button"
            class="button button-secondary button-action"
            on:click={() => copyToClipboard(passphrase)}>
            Copy
          </button>
        </div>
      </div>

      <div>
        <label for="server-url-display" class="mb-1 block text-sm font-medium">Server URL</label>
        <div class="flex gap-2">
          <input id="server-url-display" type="text" value={serverUrl} class="flex-1" readonly />
          <button
            type="button"
            class="button button-secondary button-action"
            on:click={() => copyToClipboard(serverUrl)}>
            Copy
          </button>
        </div>
      </div>

      <div>
        <label for="created-display" class="mb-1 block text-sm font-medium">Created</label>
        <input id="created-display" type="text" value={new Date(createdAt).toLocaleString()} class="w-full" readonly />
      </div>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <button type="button" class="button button-primary" on:click={handleSavedAndLogin}>
      I've Saved My Credentials
    </button>
  </svelte:fragment>
</Modal>
