<script lang="ts">
  import { page } from '$app/state';
  import Tabs from '$lib/components/common/Tabs.svelte';
  import { manifest } from '$lib';
  import { Brain, BrainCircuit, HardDrive, Info, ServerCog, Wrench, Hammer } from 'lucide-svelte';

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
      id: 'tools',
      text: 'Tools',
      title: 'Tools',
      description: 'Enable or disable tools and configure their settings.',
      icon: Hammer,
      url: '/settings/tools',
    },
    {
      id: 'memory',
      text: 'Memory',
      title: 'Memory',
      description: "Manage the model's personal memory about you.",
      icon: Brain,
      url: '/settings/memory',
    },
    {
      id: 'storage',
      text: 'Storage',
      title: 'Storage',
      description: 'View and manage storage used by your chats and attachments.',
      icon: HardDrive,
      url: '/settings/storage',
    },
    {
      id: 'advanced',
      text: 'Advanced',
      title: 'Advanced Settings',
      description: 'Developer options and advanced configurations. Use with caution.',
      icon: Wrench,
      url: '/settings/advanced',
    },
    {
      id: 'about',
      text: 'About',
      icon: Info,
      url: '/settings/about',
    },
  ];

  let activeTabId = $derived(page.url.pathname.split('/').pop() || 'providers');
  let activeTab = $derived(tabs.find((tab) => tab.id === activeTabId) || tabs[0]);
</script>

<svelte:head>
  <title>{activeTab.title} • {manifest.name}</title>
</svelte:head>

<div class="settings mx-auto mt-[3.75rem] max-w-7xl px-4 pb-8">
  <div class="mb-4 w-fit max-w-full">
    <Tabs {tabs} activeTab={activeTabId}></Tabs>
  </div>

  {#if activeTab.title && activeTab.description}
    <div class="mb-6">
      <h1 class="text-xl font-semibold">{activeTab.title}</h1>
      <p class="text-sm text-gray-500">{activeTab.description}</p>
    </div>
  {/if}

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
    @apply flex items-center gap-1 text-xl font-bold text-[var(--color-12)];
  }

  .settings :global(.panel h4) {
    @apply text-sm font-medium text-[var(--color-a12)];
  }
</style>
