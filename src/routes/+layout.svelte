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
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
  import { chats } from '$lib/stores/chat';
  import { cleanupAutoSync } from '$lib/sync/autoSync';
  import { syncManager } from '$lib/stores/sync';
  import { manifest } from '$lib';
  import { Toaster } from 'svelte-sonner';
  import GlobalShortcuts from '$lib/components/common/GlobalShortcuts.svelte';

  const SMALL_SCREEN_WIDTH = 1024; //px

  const meta = {
    title: manifest.name,
    description: manifest.description,
    image: '/logo.png',
  };

  let { children } = $props();
  let collapsed = $state(false);

  let innerWidth = $state(browser ? window.innerWidth : 0);
  let smallScreen = $derived(browser ? innerWidth < SMALL_SCREEN_WIDTH : false);

  // Check if this is first-time setup to hide sidebar
  const isFirstTime = $derived($setupStore.isFirstTime);

  let chatId = $derived(page.params.chatId);
  let activeChat = $derived(chatId ? $chats.find((chat) => chat.id === chatId) : undefined);

  onMount(() => {
    if (isFirstTime && page.url.pathname !== '/') goto('/');

    // Hot reload cleanup
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        console.log('Hot reload detected - cleaning up from layout');
        cleanupAutoSync();
        syncManager.cleanup();
      });
    }

    // Start background model sync
    const getProviderInstances = () => get(settingsManager.providerInstances);
    modelCache.startBackgroundSync(getProviderInstances, getLanguageModel);
  });

  onDestroy(() => {
    // Stop background sync when app is destroyed
    modelCache.stopBackgroundSync();

    // Cleanup auto-sync
    cleanupAutoSync();
    syncManager.cleanup();
  });
</script>

<svelte:window bind:innerWidth />

<svelte:head>
  <meta name="theme-color" content="#ff4500" />

  <meta name="twitter:card" content="summary" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={meta.title} />
  <meta name="twitter:title" content={meta.title} />
  <meta name="description" content={meta.description} />
  <meta property="og:description" content={meta.description} />
  <meta name="twitter:description" content={meta.description} />
  <meta name="thumbnail" content={meta.image} />
  <meta property="og:image" content={meta.image} />
  <meta name="twitter:image" content={meta.image} />
  <link rel="image_src" href={meta.image} />

  <!-- This should be deprecated, however Bing still uses this: -->
  {@html `<meta http-equiv="content-language" content="en-US">`}

  <!-- OpenSearch definition -->
  <link rel="search" type="application/opensearchdescription+xml" title="Helios" href="/opensearch.xml" />
</svelte:head>

<div class="flex h-screen">
  {#if !isFirstTime}
    <ChatSidebar bind:collapsed {smallScreen}></ChatSidebar>
  {/if}

  <div class="flex h-full w-full flex-1 flex-col items-center overflow-y-auto" class:small={smallScreen}>
    <div class="relative h-full w-full overflow-x-hidden">
      {#if !isFirstTime}
        <div class="header-container absolute top-0 left-1/2 z-[1] mx-auto w-full max-w-7xl -translate-x-1/2">
          <ChatHeader chat={activeChat}></ChatHeader>
        </div>
      {/if}
      {@render children()}
    </div>
  </div>
</div>

<Toaster position="top-right" theme="dark" richColors offset="16px"></Toaster>

<GlobalShortcuts isSetupComplete={!isFirstTime}></GlobalShortcuts>

<div id="portal-target"></div>

<style lang="postcss">
  @reference "tailwindcss";

  .header-container {
    background: linear-gradient(to bottom, var(--color-1), transparent);
  }

  .small .header-container {
    @apply pl-14;
  }

  .small .header-container :global(header) {
    @apply pl-0;
  }
</style>
