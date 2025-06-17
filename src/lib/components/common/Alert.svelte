<script lang="ts">
  export let type: 'success' | 'error' | 'warning' | 'info' = 'info';
  export let title: string | undefined = undefined;
  export let icon: string | undefined = undefined;

  function getDefaultIcon(alertType: string): string {
    if (alertType === 'success') return '✅';
    if (alertType === 'error') return '❌';
    if (alertType === 'warning') return '⚠️';
    return 'ℹ️';
  }

  $: displayIcon = icon !== undefined ? icon : getDefaultIcon(type);
</script>

<div class="flex items-start gap-4 rounded-lg border p-4 alert-{type}">
  {#if displayIcon}
    <div class="alert-icon flex-shrink-0 text-2xl">{displayIcon}</div>
  {/if}
  <div class="flex-1">
    {#if title}
      <h3 class="alert-title mb-1 font-semibold">{title}</h3>
    {/if}
    <div class="alert-text text-sm">
      <slot></slot>
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .alert-success {
    @apply border-green-800 bg-green-900/20;
  }

  .alert-error {
    @apply border-red-800 bg-red-900/20;
  }

  .alert-warning {
    @apply border-yellow-800 bg-yellow-900/20;
  }

  .alert-info {
    @apply border-blue-800 bg-blue-900/20;
  }

  .alert-success .alert-icon {
    @apply text-green-400;
  }

  .alert-error .alert-icon {
    @apply text-red-400;
  }

  .alert-warning .alert-icon {
    @apply text-yellow-400;
  }

  .alert-info .alert-icon {
    @apply text-blue-400;
  }

  .alert-success .alert-title {
    @apply text-green-800 dark:text-green-200;
  }

  .alert-error .alert-title {
    @apply text-red-800 dark:text-red-200;
  }

  .alert-warning .alert-title {
    @apply text-yellow-800 dark:text-yellow-200;
  }

  .alert-info .alert-title {
    @apply text-blue-800 dark:text-blue-200;
  }

  .alert-success .alert-text {
    @apply text-green-700 dark:text-green-300;
  }

  .alert-error .alert-text {
    @apply text-red-700 dark:text-red-300;
  }

  .alert-warning .alert-text {
    @apply text-yellow-700 dark:text-yellow-300;
  }

  .alert-info .alert-text {
    @apply text-blue-700 dark:text-blue-300;
  }
</style>
