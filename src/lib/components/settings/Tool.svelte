<script lang="ts">
  import type { ComponentType, SvelteComponent } from 'svelte';
  import { Settings } from 'lucide-svelte';

  export let name: string;
  export let description: string;
  export let enabled: boolean;
  export let configured: boolean; // true when all required settings (e.g. API key) are present
  export let icon: ComponentType<SvelteComponent> | null = null;
  export let onToggle: () => void;
  export let onConfigure: () => void;
</script>

<div class="button button-secondary button-large w-full !justify-between !text-left">
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

    <!-- Toggle switch -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="toggle"
      class:toggle-on={enabled}
      title={enabled ? 'Disable tool' : 'Enable tool'}
      on:click|stopPropagation={onToggle}
      role="switch"
      aria-checked={enabled}
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ' ? onToggle() : null)}>
      <div class="toggle-thumb"></div>
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .toggle {
    @apply relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors duration-200;
    background-color: var(--color-a6);

    &.toggle-on {
      background-color: var(--color-accent, #6366f1);
    }
  }

  .toggle-thumb {
    @apply absolute h-4 w-4 rounded-full bg-white shadow transition-transform duration-200;
    left: 0.25rem;

    .toggle-on & {
      transform: translateX(1.25rem);
    }
  }
</style>
