<script lang="ts">
  export let checked: boolean = false;
  export let onchange: ((checked: boolean) => void) | undefined = undefined;
  export let title: string | undefined = undefined;

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    checked = !checked;
    onchange?.(checked);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      checked = !checked;
      onchange?.(checked);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="toggle"
  class:toggle-on={checked}
  role="switch"
  aria-checked={checked}
  tabindex="0"
  {title}
  on:click={handleClick}
  on:keydown={handleKeydown}>
  <div class="toggle-thumb"></div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .toggle {
    @apply relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200;
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
