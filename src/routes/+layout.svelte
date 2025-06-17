<script lang="ts">
  import '../app.css';
  import '@fontsource/inter';
  import '$lib/styles/github-dark.css';

  import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { modelCache } from '$lib/stores/modelCache';
  import { settingsManager } from '$lib/settings/SettingsManager';
  import { setupStore } from '$lib/stores/setup';
  import { getLanguageModel } from '$lib/providers/registry';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';

  const SMALL_SCREEN_WIDTH = 1024; //px

  let { children } = $props();
  let collapsed = $state(false);

  let innerWidth = $state(browser ? window.innerWidth : 0);
  let smallScreen = $derived(browser ? innerWidth < SMALL_SCREEN_WIDTH : false);

  // Check if this is first-time setup to hide sidebar
  const isFirstTime = $derived($setupStore.isFirstTime);

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

<svelte:window bind:innerWidth />

<div class="flex h-screen">
  {#if !isFirstTime}
    <ChatSidebar bind:collapsed {smallScreen}></ChatSidebar>
  {/if}

  <div class="flex h-full w-full flex-1 flex-col items-center overflow-y-auto">
    <div class="h-full w-full max-w-7xl" class:small={smallScreen}>
      {@render children()}
    </div>
  </div>
</div>

<div id="portal-target"></div>
