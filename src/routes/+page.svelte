<script lang="ts">
  import { goto } from '$app/navigation';
  import { createNewChat } from '$lib/stores/chat';
  import { selectedModel } from '$lib/settings/SettingsManager';
  import { setupStore } from '$lib/stores/setup';
  import { manifest } from '$lib';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import SetupFlow from '$lib/components/setup/SetupFlow.svelte';
  import type { Attachment } from '$lib/types';

  let searchInput = $state('');
  let isTemporary = $state(false);
  let webSearchEnabled = $state(false);
  let webSearchContextSize: 'low' | 'medium' | 'high' = $state('low');

  // Check if this is first-time setup
  const isFirstTime = $derived($setupStore.isFirstTime);

  async function handleSearch(
    e: Event,
    attachments?: Attachment[],
    webSearchEnabled?: boolean,
    webSearchContextSize?: 'low' | 'medium' | 'high',
  ) {
    e.preventDefault();
    if (!searchInput.trim() && (!attachments || attachments.length === 0)) return;

    const newChatId = createNewChat(
      searchInput,
      isTemporary,
      attachments,
      $selectedModel?.providerInstanceId,
      webSearchEnabled,
      webSearchContextSize,
    );
    goto(`/${newChatId}`);
  }

  const sampleQueries = [
    'Write a blog post about AI and its impact on society',
    'Explain quantum computing in simple terms',
    'Create a weekly meal plan with recipes',
    'How many stars are there in the Milky Way galaxy?',
  ];
</script>

<svelte:head>
  <title>{manifest.name} • {manifest.description}</title>
</svelte:head>

{#if isFirstTime}
  <SetupFlow></SetupFlow>
{:else}
  <div class="landing flex h-full w-full flex-col items-center justify-center gap-y-8 px-4 text-center">
    <div class="flex flex-col items-center">
      <h1 class="mb-2 text-5xl font-bold">{manifest.name}<span class="text-secondary text-xs">beta</span></h1>
      <p>{manifest.description}</p>
    </div>

    <ChatInput
      bind:userInput={searchInput}
      bind:isTemporary
      bind:webSearchEnabled
      bind:webSearchContextSize
      handleSubmit={handleSearch}
      handleStop={async () => {}}
      showTemporaryToggle={true}></ChatInput>

    <div class="text-left">
      <h2 class="mb-3 text-lg font-medium">Try asking about:</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {#each sampleQueries as query}
          <button
            onclick={(e) => {
              searchInput = query;
              handleSearch(e);
            }}
            class="button button-secondary button-large">
            <p class="text-sm">{query}</p>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}
