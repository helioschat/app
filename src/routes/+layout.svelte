<script lang="ts">
  import '../app.css';
  import '@fontsource/inter';
  import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';

  let { children } = $props();
  let collapsed = $state(false);
</script>

<div class="flex h-screen">
  <ChatSidebar bind:collapsed></ChatSidebar>

  <div class="flex h-full w-full flex-1 flex-col items-center overflow-y-auto">
    <div class="h-full w-full max-w-7xl">
      {@render children()}
    </div>
  </div>
</div>

<div id="portal-target"></div>
