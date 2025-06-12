<script lang="ts">
  import '../app.css';
  import '@fontsource/inter';
  import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { modelCache } from '$lib/stores/modelCache';
  import { settingsManager } from '$lib/settings/SettingsManager';
  import { getLanguageModel } from '$lib/providers/registry';
  import { get } from 'svelte/store';

  let { children } = $props();
  let collapsed = $state(false);

  onMount(() => {
    // Start background model sync
    const getProviderInstances = () => get(settingsManager.providerInstances);
    modelCache.startBackgroundSync(getProviderInstances, getLanguageModel);
  });

  onDestroy(() => {
    // Stop background sync when app is destroyed
    modelCache.stopBackgroundSync();
  });
</script>

<div class="flex h-screen">
  <ChatSidebar bind:collapsed></ChatSidebar>

  <div class="flex h-full w-full flex-1 flex-col items-center overflow-y-auto">
    <div class="h-full w-full max-w-7xl">
      {@render children()}
    </div>
  </div>
</div>

<div id="portal-target"></div>
