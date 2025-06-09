<script lang="ts">
  import { onMount } from 'svelte';

  export let target: string = '#portal-target';

  let mounted = false;
  let targetEl: HTMLElement | null = null;
  let container: HTMLDivElement;

  onMount(() => {
    targetEl = document.querySelector(target);
    if (!targetEl) {
      console.error(`Portal target "${target}" not found in DOM`);
      return;
    }

    mounted = true;

    return () => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  });

  $: if (mounted && targetEl && container) {
    targetEl.appendChild(container);
  }
</script>

<div bind:this={container} data-portal>
  <slot />
</div>
