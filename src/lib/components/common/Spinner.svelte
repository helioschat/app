<script lang="ts">
  export let small: boolean = true;
</script>

<div
  class="block h-6 w-6 animate-[spin_0.25s_linear_infinite] motion-reduce:animate-[spin_1.5s_linear_infinite]"
  class:small
  role="status">
  <!-- TODO: Add spinner -->
  Spinner
</div>

<style lang="postcss">
  @reference "tailwindcss";

  div.small {
    @apply h-3 w-3;
  }
</style>
