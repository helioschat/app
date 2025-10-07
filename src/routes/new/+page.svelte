<script lang="ts">
  import { goto } from '$app/navigation';
  import { createNewChat } from '$lib/stores/chat';
  import { selectedModel } from '$lib/settings/SettingsManager';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { manifest } from '$lib';
  import Spinner from '$lib/components/common/Spinner.svelte';

  export let data: PageData;

  onMount(async () => {
    // Create a new chat with the query as the initial message
    const newChatId = createNewChat(
      data.query,
      false, // not temporary
      undefined, // no attachments
      $selectedModel?.providerInstanceId,
      data.webSearchEnabled, // use webSearch parameter from query
      'low', // default context size when web search is enabled
    );

    // Navigate to the new chat
    goto(`/${newChatId}`);
  });
</script>

<svelte:head>
  <title>{`Creating new chat... • ${manifest.name}`}</title>
</svelte:head>

<main class="relative flex h-full flex-1 flex-col">
  <div class="flex flex-1 items-center justify-center">
    <div class="text-center">
      <Spinner></Spinner>
    </div>
  </div>
</main>
