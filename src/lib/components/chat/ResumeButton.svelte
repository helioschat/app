<script lang="ts">
  import ChatNotice from '$lib/components/chat/ChatNotice.svelte';
  import Spinner from '$lib/components/common/Spinner.svelte';

  export let isLoading: boolean = false;
  export let handleResumeGeneration: () => Promise<void>;
</script>

<ChatNotice>
  <div class="flex items-center justify-between">
    <p>The generation was interrupted. Would you like to continue?</p>
    <button class="button button-primary" on:click={handleResumeGeneration} disabled={isLoading}>
      {#if isLoading}
        <Spinner></Spinner>
        Continuing...
      {:else}
        Continue generation
      {/if}
    </button>
  </div>
</ChatNotice>
