<script lang="ts">
  import { advancedSettings, providerInstances } from '$lib/settings/SettingsManager';
  import { modelCache } from '$lib/stores/modelCache';
  import { getDefaultTitleModel, isModelDisabledByDefault } from '$lib/providers/known';
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
    const options: Array<{ value: string; label: string; isRecommended?: boolean }> = [
      { value: '', label: 'Use provider default' },
    ];

    const allCachedModels = modelCache.getAllCachedModels();

    for (const instance of instances) {
      const cachedModels = allCachedModels[instance.id];
      const defaultModel = getDefaultTitleModel(instance.config.matchedProvider || '');
      const addedModels = new Set<string>();

      if (cachedModels && cachedModels.length > 0) {
        // Add fast/small models that are suitable for title generation
        const suitableModels = cachedModels.filter(
          (model: ModelInfo) =>
            (model.name.toLowerCase().includes('mini') ||
              model.name.toLowerCase().includes('small') ||
              model.name.toLowerCase().includes('nano') ||
              model.name.toLowerCase().includes(':free') ||
              model.name.toLowerCase().includes('flash') ||
              model.name.toLowerCase().includes('haiku') ||
              model.name.toLowerCase().includes('turbo')) &&
            !isModelDisabledByDefault(instance.config.matchedProvider || '', model.id),
        );

        for (const model of suitableModels) {
          const modelKey = `${instance.id}:${model.id}`;
          if (!addedModels.has(modelKey)) {
            addedModels.add(modelKey);
            const isDefault = model.id === defaultModel;
            options.push({
              value: modelKey,
              label: `${instance.name} - ${model.name}${isDefault ? ' (recommended)' : ''}`,
              isRecommended: isDefault,
            });
          }
        }
      }

      // Add the default title model if it wasn't already added from cached models
      if (defaultModel) {
        const defaultModelKey = `${instance.id}:${defaultModel}`;
        if (!addedModels.has(defaultModelKey)) {
          options.push({
            value: defaultModelKey,
            label: `${instance.name} - ${defaultModel} (recommended)`,
            isRecommended: true,
          });
        }
      }
    }

    // Sort options so recommended models come first
    const [defaultOption, ...otherOptions] = options;
    const sortedOptions = otherOptions.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return a.label.localeCompare(b.label);
    });

    return [defaultOption, ...sortedOptions];
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

<div class="panel">
  <h3>Generation Settings</h3>

  <div class="section">
    <h4>System Prompt</h4>
    <div>
      <textarea
        id="systemPrompt"
        bind:value={currentSettings.systemPrompt}
        on:change={updateSettings}
        class="h-32 w-full"
        placeholder="Enter system instructions for the AI"></textarea>
      <p class="text-secondary text-xs opacity-75">Instructions that set the behavior of the AI assistant</p>
    </div>
  </div>

  <div class="section">
    <h4>Chat Title Generation</h4>

    <div>
      <input
        id="titleGeneration"
        type="checkbox"
        bind:checked={currentSettings.titleGenerationEnabled}
        on:change={updateSettings} />
      <label for="titleGeneration" class="select-none">Enable automatic chat title generation</label>
      <p class="text-secondary text-xs opacity-75">
        Automatically generate descriptive titles for new chats based on the first message
      </p>
    </div>
  </div>
  {#if currentSettings.titleGenerationEnabled}
    <div class="section">
      <h4>Title Generation Model</h4>

      <div>
        <select
          id="titleModel"
          bind:value={currentSettings.titleGenerationModel}
          on:change={updateSettings}
          class="w-full">
          {#each titleModelOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        <p class="text-secondary text-xs opacity-75">
          Choose which model to use for generating chat titles. Smaller/faster models are recommended.
        </p>
      </div>
    </div>
  {/if}
</div>

<div class="panel">
  <h3>Danger Zone</h3>

  <div class="flex flex-wrap gap-2">
    <button class="button button-secondary" on:click={clearModelCache}>Clear model cache</button>
    <button class="button button-secondary" on:click={resetSetupStatus}>Reset setup status</button>
    <button class="button button-danger" on:click={clearSyncSettings}>Clear All Sync Settings</button>
  </div>
</div>
