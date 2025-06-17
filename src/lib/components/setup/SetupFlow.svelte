<script lang="ts">
  import { setupStore, completeSetup, skipSetup, nextSetupStep, setSetupStep } from '$lib/stores/setup';
  import SetupWelcome from './SetupWelcome.svelte';
  import SetupProvider from './SetupProvider.svelte';
  import SetupAddMore from './SetupAddMore.svelte';

  $: currentStep = $setupStore.currentStep;
</script>

<div class="setup flex min-h-screen items-center justify-center px-2.5 py-16">
  {#if currentStep === 'welcome'}
    <SetupWelcome on:continue={nextSetupStep} on:skip={skipSetup}></SetupWelcome>
  {:else if currentStep === 'provider'}
    <SetupProvider on:continue={() => setSetupStep('add-more')} on:skip={skipSetup}></SetupProvider>
  {:else if currentStep === 'add-more'}
    <SetupAddMore on:continue={completeSetup} on:add-more={() => setSetupStep('provider')} on:skip={skipSetup}
    ></SetupAddMore>
  {/if}
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .setup :global(.setup-card) {
    @apply flex w-full max-w-lg flex-col gap-6 rounded-lg bg-[var(--color-a2)] p-8 shadow-lg;
  }

  .setup :global(.setup-header) {
    @apply text-center;
  }

  .setup :global(.setup-title) {
    @apply mb-4 text-3xl font-bold;
  }

  .setup :global(.setup-description) {
    @apply leading-relaxed text-[var(--color-11)];
  }

  .setup :global(.setup-content) {
    @apply flex flex-col gap-4;
  }

  .setup :global(.setup-actions) {
    @apply flex flex-col items-center gap-1;
  }

  .setup :global(.setup-actions .button) {
    @apply w-full;
  }

  .setup :global(.setup-actions .button-skip) {
    @apply w-fit text-center text-sm text-[var(--color-11)] outline-none hover:text-[var(--color-12)] hover:underline active:text-[var(--color-a12)];
  }

  .setup :global(.required-indicator) {
    @apply ml-0.5 text-xs text-red-500;
  }
</style>
