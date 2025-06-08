<script lang="ts">
  import type { Chat } from '$lib/types';

  export let chat: Chat;
</script>

<header class="flex items-center justify-between p-4">
  <h2 class="text-lg font-semibold drop-shadow-md">{chat.title}</h2>
</header>

<style lang="postcss">
  @reference "tailwindcss";

  header {
    background: linear-gradient(to bottom, var(--color-1), transparent);
  }
</style>
