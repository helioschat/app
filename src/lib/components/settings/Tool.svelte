<script lang="ts">
  import type { ComponentType, SvelteComponent } from 'svelte';
  import { Settings } from 'lucide-svelte';
  import Toggle from '$lib/components/common/Toggle.svelte';

  export let name: string;
  export let description: string;
  export let enabled: boolean;
  export let configured: boolean; // true when all required settings (e.g. API key) are present
  export let icon: ComponentType<SvelteComponent> | null = null;
  export let onToggle: () => void;
  export let onConfigure: () => void;
</script>

<div
  class="button button-secondary button-large w-full !justify-between !text-left"
  on:click={onToggle}
  role="button"
  tabindex="0"
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  }}>
  <div class="flex gap-3">
    <div class="flex items-center">
      {#if icon}
        <svelte:component this={icon} size={32} class="text-[var(--color-12)]" />
      {/if}
    </div>
    <div class="flex flex-col justify-center gap-1">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold">{name}</h3>
        {#if !configured}
          <span
            class="rounded px-1.5 py-0.5 text-xs font-medium"
            style="background: var(--color-a3); color: var(--color-a11);">
            Not configured
          </span>
        {/if}
      </div>
      <h4 class="text-secondary">{description}</h4>
    </div>
  </div>

  <div class="flex items-center gap-1">
    <button class="button button-ghost button-circle" title="Configure" on:click|stopPropagation={onConfigure}>
      <Settings size={20} />
    </button>

    <Toggle checked={enabled} title={enabled ? 'Disable tool' : 'Enable tool'} onchange={onToggle} />
  </div>
</div>
