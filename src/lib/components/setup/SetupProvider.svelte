<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { addProviderInstance } from '$lib/stores/settings';
  import ProviderForm from '../common/ProviderForm.svelte';

  const dispatch = createEventDispatcher<{
    continue: void;
    skip: void;
  }>();

  let name = '';
  let apiKey = '';
  let baseURL = '';
  let selectedKnownProvider: string | null = null;

  function handleProviderSelect(event: CustomEvent<{ providerId: string }>) {
    selectedKnownProvider = event.detail.providerId;
  }

  function handleCustomSelect() {
    selectedKnownProvider = null;
  }

  function handleContinue() {
    if (name && apiKey && baseURL) {
      try {
        const providerId = addProviderInstance(name, 'openai-compatible', {
          apiKey,
          baseURL,
          matchedProvider: selectedKnownProvider || undefined,
        });

        // Sync models and apply default disabled models for the new provider in the background
        // Don't await this to avoid blocking the user flow
        (async () => {
          try {
            const { getLanguageModel } = await import('$lib/providers/registry');
            const { modelCache } = await import('$lib/stores/modelCache');
            const { settingsManager } = await import('$lib/settings/SettingsManager');

            const newProvider = {
              id: providerId,
              name,
              providerType: 'openai-compatible' as const,
              config: { apiKey, baseURL, matchedProvider: selectedKnownProvider || undefined },
            };

            await modelCache.syncProvider(newProvider, getLanguageModel);

            // Apply default disabled models based on known provider metadata
            const all = modelCache.getAllCachedModels();
            const modelsForProvider = all[providerId] ?? [];
            settingsManager.applyDefaultDisabledModels(
              providerId,
              selectedKnownProvider || undefined,
              modelsForProvider,
            );
          } catch (error) {
            console.error('Failed to sync models for new provider:', error);
          }
        })();

        dispatch('continue');
      } catch (error) {
        console.error('Failed to add provider:', error);
      }
    }
  }

  $: canContinue = name.trim() && apiKey.trim() && baseURL.trim();
</script>

<div class="setup-card">
  <div class="setup-header">
    <h1 class="setup-title">Choose Your First LLM Provider</h1>
    <p class="setup-description">Select a provider below or configure a custom OpenAI-compatible API.</p>
  </div>

  <div class="setup-content">
    <!-- Provider Form Component -->
    <ProviderForm
      bind:name
      bind:apiKey
      bind:baseURL
      bind:selectedKnownProvider
      on:providerSelect={handleProviderSelect}
      on:customSelect={handleCustomSelect} />
  </div>

  <div class="setup-actions">
    <button class="button button-primary" on:click={handleContinue} disabled={!canContinue}> Continue </button>
    <button class="button button-ghost" on:click={() => dispatch('skip')}> Skip setup </button>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";
</style>
