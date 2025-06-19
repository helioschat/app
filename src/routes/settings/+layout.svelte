<script lang="ts">
  import { page } from '$app/state';
  import Tabs from '$lib/components/common/Tabs.svelte';
  import { manifest } from '$lib';
  import { BrainCircuit, CloudUpload, ServerCog, Wrench } from 'lucide-svelte';

  const tabs = [
    { id: 'providers', text: 'Providers', icon: ServerCog, url: '/settings/providers' },
    { id: 'models', text: 'Models', icon: BrainCircuit, url: '/settings/models' },
    { id: 'sync', text: 'Sync', icon: CloudUpload, url: '/settings/sync' },
    { id: 'advanced', text: 'Advanced', icon: Wrench, url: '/settings/advanced' },
  ];

  $: activeTab = page.url.pathname.split('/').pop() || 'providers';
</script>

<svelte:head>
  <title>{manifest.name}</title>
</svelte:head>

<div class="settings mt-[3.75rem] px-4 pb-8">
  <div class="mb-4 w-fit">
    <Tabs {tabs} {activeTab}></Tabs>
  </div>

  <div class="flex flex-col gap-4">
    <slot></slot>
  </div>
</div>
