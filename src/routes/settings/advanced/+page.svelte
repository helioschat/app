<script lang="ts">
  import { advancedSettings, providerInstances } from '$lib/settings/SettingsManager';
  import { modelCache } from '$lib/stores/modelCache';
  import { getDefaultTitleModel } from '$lib/providers/known';
  import type { ProviderInstance } from '$lib/types';
  import type { ModelInfo } from '$lib/providers/base';
  import { resetSetup } from '$lib/stores/setup';
  import { goto } from '$app/navigation';
  import { syncManager } from '$lib/stores/sync';

  $: currentSettings = $advancedSettings;
  $: instances = $providerInstances;

  // Get all available models for title generation across all providers
  $: titleModelOptions = getTitleModelOptions(instances);

  function getTitleModelOptions(instances: ProviderInstance[]) {
    const options: Array<{ value: string; label: string }> = [{ value: '', label: 'Use provider default' }];

    const allCachedModels = modelCache.getAllCachedModels();

    for (const instance of instances) {
      const cachedModels = allCachedModels[instance.id];
      if (cachedModels && cachedModels.length > 0) {
        // Add fast/small models that are suitable for title generation
        const suitableModels = cachedModels.filter(
          (model: ModelInfo) =>
            model.name.toLowerCase().includes('mini') ||
            model.name.toLowerCase().includes('small') ||
            model.name.toLowerCase().includes('nano') ||
            model.name.toLowerCase().includes(':free') ||
            model.name.toLowerCase().includes('flash') ||
            model.name.toLowerCase().includes('haiku') ||
            model.name.toLowerCase().includes('turbo'),
        );

        for (const model of suitableModels) {
          options.push({
            value: `${instance.id}:${model.id}`,
            label: `${instance.name} - ${model.name}`,
          });
        }
      }

      // Also add the default title model if known
      const defaultModel = getDefaultTitleModel(instance.config.matchedProvider || '');
      if (defaultModel) {
        options.push({
          value: `${instance.id}:${defaultModel}`,
          label: `${instance.name} - ${defaultModel} (recommended)`,
        });
      }
    }

    return options;
  }

  function updateSettings() {
    advancedSettings.update((settings) => {
      return { ...settings };
    });
  }

  function clearModelCache() {
    modelCache.clearCache();
    alert('Model cache cleared');
  }

  function resetSetupStatus() {
    resetSetup();
    goto('/');
  }

  function clearSyncSettings() {
    syncManager.clearSyncSettings();
  }
</script>

<div>
  <label for="systemPrompt">System Prompt</label>
  <textarea
    id="systemPrompt"
    bind:value={currentSettings.systemPrompt}
    on:change={updateSettings}
    class="h-32 w-full"
    placeholder="Enter system instructions for the AI"></textarea>
  <p class="text-secondary">Instructions that set the behavior of the AI assistant</p>
</div>

<div>
  <label for="titleGeneration">Chat Title Generation</label>
  <div class="mb-2 flex items-center gap-2">
    <input
      id="titleGeneration"
      type="checkbox"
      bind:checked={currentSettings.titleGenerationEnabled}
      on:change={updateSettings} />
    <span>Enable automatic chat title generation</span>
  </div>
  <p class="text-secondary mb-3">Automatically generate descriptive titles for new chats based on the first message</p>

  {#if currentSettings.titleGenerationEnabled}
    <div>
      <label for="titleModel">Title Generation Model</label>
      <select
        id="titleModel"
        bind:value={currentSettings.titleGenerationModel}
        on:change={updateSettings}
        class="w-full">
        {#each titleModelOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      <p class="text-secondary">
        Choose which model to use for generating chat titles. Smaller/faster models are recommended.
      </p>
    </div>
  {/if}
</div>

<div>
  <p>Developer Options</p>
  <div class="flex flex-wrap gap-2">
    <button class="button button-primary" on:click={clearModelCache}>Clear model cache</button>
    <button class="button button-primary" on:click={resetSetupStatus}>Reset setup status</button>
    <button class="button button-primary" on:click={clearSyncSettings}>Clear All Sync Settings</button>
  </div>
</div>
