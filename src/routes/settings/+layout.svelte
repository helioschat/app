<script lang="ts">
  import { page } from '$app/state';
  import Tabs from '$lib/components/common/Tabs.svelte';
  import { manifest } from '$lib';
  import { BrainCircuit, CloudUpload, ServerCog, Wrench } from 'lucide-svelte';

  const tabs = [
    {
      id: 'providers',
      text: 'Providers',
      title: 'Manage Providers',
      description: 'Add, remove, and configure your AI providers.',
      icon: ServerCog,
      url: '/settings/providers',
    },
    {
      id: 'models',
      text: 'Models',
      title: 'Model Configuration',
      description: 'Enable or disable models for each provider.',
      icon: BrainCircuit,
      url: '/settings/models',
    },
    {
      id: 'sync',
      text: 'Sync',
      title: 'Sync Settings',
      description: 'Manage your chat synchronization settings.',
      icon: CloudUpload,
      url: '/settings/sync',
    },
    {
      id: 'advanced',
      text: 'Advanced',
      title: 'Advanced Settings',
      description: 'Developer options and advanced configurations. Use with caution.',
      icon: Wrench,
      url: '/settings/advanced',
    },
  ];

  $: activeTabId = page.url.pathname.split('/').pop() || 'providers';
  $: activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];

  const handleTabChange = (e: Event) => {
    activeTabId = (e.target as HTMLInputElement).value;
  };
</script>

<svelte:head>
  <title>{manifest.name}</title>
</svelte:head>

<div class="settings mt-[3.75rem] px-4 pb-8">
  <div class="mb-4 w-fit">
    <Tabs {tabs} activeTab={activeTabId} onChange={handleTabChange}></Tabs>
  </div>

  <div class="mb-6">
    <h2 class="text-xl font-semibold">{activeTab.title}</h2>
    <p class="text-sm text-gray-500">{activeTab.description}</p>
  </div>

  <div class="flex flex-col gap-4">
    <slot></slot>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .settings :global(.panel) {
    @apply flex flex-col gap-3 rounded-lg bg-[var(--color-2)] p-4 shadow-lg;
  }

  .settings :global(.panel .section) {
    @apply flex flex-col gap-2;
  }

  .settings :global(.panel h3) {
    @apply text-xl font-bold text-[var(--color-12)];
  }

  .settings :global(.panel h4) {
    @apply text-sm font-medium text-[var(--color-a12)];
  }
</style>
