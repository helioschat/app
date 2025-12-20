<script lang="ts">
  export let type: 'info' | 'warning' | 'error' = 'info';
</script>

<div class="message notice">
  <div
    class="my-4 rounded-md p-4"
    class:level-info={type === 'info'}
    class:level-warning={type === 'warning'}
    class:level-error={type === 'error'}>
    <slot></slot>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .level-info {
    @apply bg-blue-600/35;
  }
  .level-warning {
    @apply bg-yellow-600/35;
  }
  .level-error {
    @apply bg-red-600/35;
  }
</style>
