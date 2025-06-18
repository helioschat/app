<script lang="ts">
  import { page } from '$app/state';
  import Tabs from '$lib/components/common/Tabs.svelte';
  import { goto } from '$app/navigation';
  import { manifest } from '$lib';

  const tabs = [
    { id: 'providers', text: 'Providers', path: '/settings/providers' },
    { id: 'models', text: 'Models', path: '/settings/models' },
    { id: 'sync', text: 'Sync', path: '/settings/sync' },
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

<div class="settings mt-[3.75rem] px-4">
  <div class="mb-4 w-fit">
    <Tabs {tabs} {activeTab} onChange={handleTabChange}></Tabs>
  </div>

  <div class="flex flex-col gap-4">
    <slot></slot>
  </div>
</div>
