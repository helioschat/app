<script lang="ts">
  import { Send } from 'lucide-svelte';
  import Spinner from '$lib/components/common/Spinner.svelte';

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (e: Event) => Promise<void>;
</script>

<form
  on:submit={(e) => {
    e.preventDefault();
    handleSubmit(e);
  }}
  class="mx-auto mb-8 flex w-full max-w-4xl gap-4">
  <input
    type="text"
    bind:value={userInput}
    placeholder="Ask anything..."
    disabled={isLoading}
    class="min-h-12 flex-1" />
  <button type="submit" disabled={isLoading} class="button button-main h-12 w-12">
    {#if isLoading}
      <Spinner></Spinner>
    {:else}
      <Send size={20}></Send>
    {/if}
  </button>
</form>
