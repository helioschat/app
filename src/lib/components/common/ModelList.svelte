<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ModelItem from './ModelItem.svelte';
  import { Search, Funnel, Image, Text, Brain, Star, Clock, Wrench } from 'lucide-svelte';
  import type { ModelInfo } from '$lib/providers/base';
  import type { ProviderInstance } from '$lib/types';
  import { settingsManager } from '$lib/settings/SettingsManager';
  import Pill from './Pill.svelte';
  import { slide } from 'svelte/transition';
  import { getKnownProviderMeta } from '$lib/providers/known';
  import { favoriteModels, lastUsedModels } from '$lib/stores/modelPreferences';

  export let providerInstances: ProviderInstance[] = [];
  export let availableModels: Record<string, ModelInfo[]> = {};
  export let mode: 'select' | 'toggle' = 'select';
  export let showSearch = true;
  export let maxHeight = '400px';
  export let currentModelId: string | undefined = undefined;
  export let enabledModelsState: Record<string, string[]> = {};

  let searchQuery = '';
  let showFilters = false;

  // Filter states
  let filterFileInput = false;
  let filterImageInput = false;
  let filterImageGeneration = false;
  let filterReasoning = false;
  let filterWebSearch = false;
  let filterTools = false;
  let selectedProviderIds: string[] = [];

  const dispatch = createEventDispatcher<{
    select: { providerInstanceId: string; modelId: string };
    toggle: { providerInstanceId: string; modelId: string };
  }>();

  function handleSelect(providerInstanceId: string, modelId: string) {
    dispatch('select', { providerInstanceId, modelId });
  }

  function handleToggle(providerInstanceId: string, modelId: string) {
    dispatch('toggle', { providerInstanceId, modelId });
  }

  function isModelEnabled(providerInstanceId: string, modelId: string) {
    if (mode === 'select') {
      return settingsManager.isModelEnabled(providerInstanceId, modelId);
    } else {
      return !(enabledModelsState[providerInstanceId]?.includes(modelId) ?? false);
    }
  }

  // Helper functions to detect model capabilities
  function supportsFileInput(model: ModelInfo): boolean {
    return model.architecture?.inputModalities?.includes('file') ?? false;
  }

  function supportsImageInput(model: ModelInfo): boolean {
    return model.architecture?.inputModalities?.includes('image') ?? false;
  }

  function supportsImageGeneration(model: ModelInfo): boolean {
    return model.architecture?.outputModalities?.includes('image') ?? false;
  }

  function supportsReasoning(model: ModelInfo): boolean {
    return (model as any).supportsReasoning ?? false;
  }

  function supportsWebSearch(model: ModelInfo): boolean {
    return (model as any).supportsWebSearch ?? false;
  }

  function supportsTools(model: ModelInfo): boolean {
    return (model as any).supportsTools ?? false;
  }

  // Clear all filters
  function clearFilters() {
    filterFileInput = false;
    filterImageInput = false;
    filterImageGeneration = false;
    filterReasoning = false;
    filterWebSearch = false;
    filterTools = false;
    selectedProviderIds = [];
  }

  // Check if any filters are active
  $: hasActiveFilters =
    filterFileInput ||
    filterImageInput ||
    filterImageGeneration ||
    filterReasoning ||
    filterWebSearch ||
    filterTools ||
    selectedProviderIds.length > 0;

  // Clear filters when filter panel is closed
  $: if (!showFilters && hasActiveFilters) {
    clearFilters();
  }

  function toggleProvider(providerId: string) {
    if (selectedProviderIds.includes(providerId)) {
      selectedProviderIds = selectedProviderIds.filter((id) => id !== providerId);
    } else {
      selectedProviderIds = [...selectedProviderIds, providerId];
    }
  }

  function getFilteredModels(instance: ProviderInstance) {
    const allInstanceModels = availableModels[instance.id] || [];

    let filteredModels = allInstanceModels;

    // Apply search filter
    if (searchQuery) {
      filteredModels = filteredModels.filter((model) => model.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Apply capability filters with OR logic
    const hasCapabilityFilters =
      filterFileInput || filterImageInput || filterImageGeneration || filterReasoning || filterWebSearch || filterTools;
    if (hasCapabilityFilters) {
      filteredModels = filteredModels.filter((model) => {
        return (
          (filterFileInput && supportsFileInput(model)) ||
          (filterImageInput && supportsImageInput(model)) ||
          (filterImageGeneration && supportsImageGeneration(model)) ||
          (filterReasoning && supportsReasoning(model)) ||
          (filterWebSearch && supportsWebSearch(model)) ||
          (filterTools && supportsTools(model))
        );
      });
    }

    // Apply provider filter
    if (selectedProviderIds.length > 0 && !selectedProviderIds.includes(instance.id)) {
      return [];
    }

    if (mode === 'select') {
      return filteredModels.filter((model) => settingsManager.isModelEnabled(instance.id, model.id));
    } else {
      return filteredModels;
    }
  }

  // Build a lookup: providerInstanceId -> icon URL
  $: providerIconMap = (() => {
    const map: Record<string, string | undefined> = {};
    for (const instance of providerInstances) {
      const meta = instance.config.matchedProvider ? getKnownProviderMeta(instance.config.matchedProvider) : undefined;
      map[instance.id] = meta?.icon;
    }
    return map;
  })();

  // Build a flat lookup: modelId -> { model, providerInstanceId }
  $: allEnabledModels = (() => {
    const result: Record<string, { model: ModelInfo; providerInstanceId: string }> = {};
    for (const instance of providerInstances) {
      const models = availableModels[instance.id] || [];
      for (const model of models) {
        if (settingsManager.isModelEnabled(instance.id, model.id)) {
          result[`${instance.id}::${model.id}`] = { model, providerInstanceId: instance.id };
        }
      }
    }
    return result;
  })();

  // Resolved favorite entries (only show models that are currently available + enabled)
  $: resolvedFavorites = $favoriteModels
    .map((fav) => allEnabledModels[`${fav.providerInstanceId}::${fav.modelId}`])
    .filter(Boolean) as { model: ModelInfo; providerInstanceId: string }[];

  // Resolved last-used entries (only show models that are currently available + enabled, exclude favorites)
  $: resolvedLastUsed = $lastUsedModels
    .map((entry) => {
      const resolved = allEnabledModels[`${entry.providerInstanceId}::${entry.modelId}`];
      if (!resolved) return null;
      // Exclude models already shown in favorites
      const isFav = $favoriteModels.some(
        (f) => f.providerInstanceId === entry.providerInstanceId && f.modelId === entry.modelId,
      );
      return isFav ? null : resolved;
    })
    .filter(Boolean) as { model: ModelInfo; providerInstanceId: string }[];

  // Filter specials by search query too
  $: filteredFavorites = searchQuery
    ? resolvedFavorites.filter((e) => e.model.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : resolvedFavorites;

  $: filteredLastUsed = searchQuery
    ? resolvedLastUsed.filter((e) => e.model.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : resolvedLastUsed;

  $: showSpecialSections = mode === 'select' && !hasActiveFilters;
</script>

<div>
  {#if showSearch}
    <div class="mb-4 flex items-center gap-2">
      <Search size={20}></Search>
      <input type="text" bind:value={searchQuery} placeholder="Search models..." class="flex-1" />
      <button
        class="button button-tertiary button-small button-circle !h-9 !w-9"
        class:active={showFilters}
        on:click={() => (showFilters = !showFilters)}
        title="Toggle filters">
        <Funnel size={16}></Funnel>
      </button>
    </div>

    {#if showFilters}
      <div
        class="mb-4 w-full rounded-lg border border-[var(--color-a6)]/50 bg-[var(--color-a2)] p-2"
        transition:slide={{ duration: 125 }}>
        <div class="w-full">
          <div class="flex flex-wrap gap-2">
            <button
              class="filter-btn"
              class:inactive={!filterFileInput}
              on:click={() => (filterFileInput = !filterFileInput)}>
              <Pill icon={Text} text="File Input" variant={filterFileInput ? 'success' : 'default'} size="md"></Pill>
            </button>
            <button
              class="filter-btn"
              class:inactive={!filterImageInput}
              on:click={() => (filterImageInput = !filterImageInput)}>
              <Pill icon={Image} text="Image Input" variant={filterImageInput ? 'secondary' : 'default'} size="md"
              ></Pill>
            </button>
            <button
              class="filter-btn"
              class:inactive={!filterImageGeneration}
              on:click={() => (filterImageGeneration = !filterImageGeneration)}>
              <Pill
                icon={Image}
                text="Image Generation"
                variant={filterImageGeneration ? 'warning' : 'default'}
                size="md"></Pill>
            </button>
            <button
              class="filter-btn"
              class:inactive={!filterReasoning}
              on:click={() => (filterReasoning = !filterReasoning)}>
              <Pill icon={Brain} text="Reasoning" variant={filterReasoning ? 'special' : 'default'} size="md"></Pill>
            </button>
            <button
              class="filter-btn"
              class:inactive={!filterWebSearch}
              on:click={() => (filterWebSearch = !filterWebSearch)}>
              <Pill icon={Search} text="Web Search" variant={filterWebSearch ? 'error' : 'default'} size="md"></Pill>
            </button>
            <button class="filter-btn" class:inactive={!filterTools} on:click={() => (filterTools = !filterTools)}>
              <Pill icon={Wrench} text="Tool Use" variant={filterTools ? 'cyan' : 'default'} size="md"></Pill>
            </button>
            {#if providerInstances.length > 1}
              <div class="h-8 w-px bg-[var(--color-a6)]"></div>
              {#each providerInstances as instance (instance.id)}
                {@const matchedProvider = instance.config.matchedProvider
                  ? getKnownProviderMeta(instance.config.matchedProvider)
                  : null}
                <button
                  class="filter-btn"
                  class:inactive={!selectedProviderIds.includes(instance.id)}
                  on:click={() => toggleProvider(instance.id)}>
                  <Pill text={instance.name} size="md">
                    {#if matchedProvider && matchedProvider.icon}
                      <div class="provider-icon h-3.5 w-3.5 bg-white" style="--icon: url({matchedProvider.icon});">
                      </div>
                    {/if}
                  </Pill>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <div class="min-h-[400px] space-y-4 overflow-x-hidden overflow-y-auto" style="max-height: {maxHeight}">
    {#if showSpecialSections && filteredFavorites.length > 0}
      <div class="space-y-2" transition:slide={{ duration: 125 }}>
        <div class="section-header">
          <Star size={13} class="text-amber-400" />
          <span>Favorites</span>
        </div>
        {#each filteredFavorites as entry (entry.providerInstanceId + '::' + entry.model.id)}
          <ModelItem
            model={entry.model}
            providerInstanceId={entry.providerInstanceId}
            providerIconUrl={providerIconMap[entry.providerInstanceId]}
            {mode}
            minimal={true}
            isActive={mode === 'select' && entry.model.id === currentModelId}
            onclick={mode === 'select' ? () => handleSelect(entry.providerInstanceId, entry.model.id) : undefined} />
        {/each}
        <div class="section-divider"></div>
      </div>
    {/if}

    {#if showSpecialSections && filteredLastUsed.length > 0}
      <div class="space-y-2" transition:slide={{ duration: 125 }}>
        <div class="section-header">
          <Clock size={13} class="text-[var(--color-a9)]" />
          <span>Last Used</span>
        </div>
        {#each filteredLastUsed as entry (entry.providerInstanceId + '::' + entry.model.id)}
          <ModelItem
            model={entry.model}
            providerInstanceId={entry.providerInstanceId}
            providerIconUrl={providerIconMap[entry.providerInstanceId]}
            {mode}
            minimal={true}
            isActive={mode === 'select' && entry.model.id === currentModelId}
            onclick={mode === 'select' ? () => handleSelect(entry.providerInstanceId, entry.model.id) : undefined} />
        {/each}
        <div class="section-divider"></div>
      </div>
    {/if}

    {#if providerInstances.length > 0}
      {#each providerInstances as instance (instance.id)}
        {@const filteredModels = getFilteredModels(instance)}
        {@const matchedProvider = instance.config.matchedProvider
          ? getKnownProviderMeta(instance.config.matchedProvider)
          : null}

        {#if filteredModels.length > 0}
          <div class="space-y-2">
            <div class="flex items-center gap-1">
              {#if matchedProvider && matchedProvider.icon}
                <div class="provider-icon h-3.5 w-3.5 bg-white" style="--icon: url({matchedProvider.icon});"></div>
              {/if}
              <h3 class="text-primary text-sm font-semibold">{instance.name}</h3>
            </div>
            {#each filteredModels as model (model.id)}
              <ModelItem
                {model}
                providerInstanceId={instance.id}
                providerIconUrl={providerIconMap[instance.id]}
                {mode}
                minimal={mode === 'select'}
                isActive={mode === 'select' && model.id === currentModelId}
                isEnabled={mode === 'toggle' ? isModelEnabled(instance.id, model.id) : undefined}
                onclick={mode === 'select' ? () => handleSelect(instance.id, model.id) : undefined}
                onchange={mode === 'toggle' ? () => handleToggle(instance.id, model.id) : undefined} />
            {/each}
          </div>
        {:else if !hasActiveFilters}
          <p class="empty-notice">No providers with available models found. Please configure your providers first.</p>
        {/if}
      {/each}
      {#if hasActiveFilters && [...providerInstances.map( (p) => getFilteredModels(p), )].every((models) => models.length === 0)}
        <p class="empty-notice">No models match the current filters.</p>
      {/if}
    {:else if !hasActiveFilters}
      <p class="empty-notice">
        No providers found. Please <a class="link" href="/settings/providers">configure your providers</a> first.
      </p>
    {/if}
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .provider-icon {
    mask-position: center;
    mask-size: 100%;
    mask-repeat: no-repeat;
    mask-image: var(--icon);
  }

  .empty-notice {
    @apply my-8 text-center text-sm text-[var(--color-a11)];
  }

  .filter-btn {
    @apply cursor-pointer transition-opacity outline-none select-none;
  }

  .filter-btn.inactive {
    @apply opacity-50;
  }

  .section-header {
    @apply flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase;
    color: var(--color-a10);
    padding-inline-start: 0.25rem;
  }

  .section-divider {
    @apply mt-2 border-t border-[var(--color-a4)];
  }
</style>
