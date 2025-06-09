<script lang="ts">
  import { goto } from '$app/navigation';
  import { createNewChat } from '$lib/stores/chat';
  import { manifest } from '$lib';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';

  let searchInput = $state('');

  async function handleSearch(e: Event) {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const newChatId = createNewChat(searchInput);
    goto(`/${newChatId}`);
  }

  const sampleQueries = [
    'Write a blog post about AI and its impact on society',
    'Explain quantum computing in simple terms',
    'Create a weekly meal plan with recipes',
    'How many stars are there in the Milky Way galaxy?',
  ];
</script>

<div class="landing flex h-full w-full flex-col items-center justify-center gap-y-8 px-4 text-center">
  <div class="flex flex-col items-center">
    <h1 class="mb-2 text-5xl font-bold">{manifest.name}</h1>
    <p>{manifest.description}</p>
  </div>

  <ChatInput bind:userInput={searchInput} handleSubmit={handleSearch} handleStop={async () => {}}></ChatInput>

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
