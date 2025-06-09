<script lang="ts">
  import { Send, Square } from 'lucide-svelte';

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (e: Event) => Promise<void>;
  export let handleStop: () => Promise<void>;
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
  {#if isLoading}
    <button type="button" on:click={handleStop} class="button button-main h-12 w-12">
      <Square size={20}></Square>
    </button>
  {:else}
    <button type="submit" class="button button-main h-12 w-12">
      <Send size={20}></Send>
    </button>
  {/if}
</form>
