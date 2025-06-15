<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft } from 'lucide-svelte';
  import Tabs from '$lib/components/common/Tabs.svelte';
  import { goto } from '$app/navigation';
  import { activeChatId } from '$lib/stores/chat';
  import { manifest } from '$lib';

  const tabs = [
    { id: 'providers', text: 'Providers', path: '/settings/providers' },
    { id: 'models', text: 'Models', path: '/settings/models' },
    { id: 'advanced', text: 'Advanced', path: '/settings/advanced' },
  ];

  $: activeTab = page.url.pathname.split('/').pop() || 'providers';

  const handleTabChange = (e: Event) => {
    goto(`/settings/${(e.target as HTMLInputElement).value}`);
  };
</script>

<svelte:head>
  <title>{manifest.name}</title>
</svelte:head>

<div class="settings p-4">
  <button onclick={() => goto(`/${$activeChatId}`)} class="button button-secondary">
    <ArrowLeft size={20}></ArrowLeft>
    Back to Chat
  </button>

  <div class="mt-8">
    <div class="mb-4 w-fit">
      <Tabs {tabs} {activeTab} onChange={handleTabChange}></Tabs>
    </div>

    <div class="flex flex-col gap-4">
      <slot></slot>
    </div>
  </div>
</div>
