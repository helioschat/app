<script lang="ts">
  import { VenetianMask } from 'lucide-svelte';
  import type { Chat } from '$lib/types';

  export let chat: Chat;
</script>

<header class="flex items-center justify-between p-4">
  <div class="flex items-center gap-2">
    {#if chat.temporary}
      <div title="Temporary chat (won't be saved)" class="flex items-center">
        <VenetianMask size={16}></VenetianMask>
      </div>
    {/if}
    <h2 class="text-lg font-semibold drop-shadow-md">{chat.title}</h2>
  </div>
</header>

<style lang="postcss">
  @reference "tailwindcss";

  header {
    background: linear-gradient(to bottom, var(--color-1), transparent);
  }
</style>
