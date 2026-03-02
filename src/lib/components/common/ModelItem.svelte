<script lang="ts">
  import type { ModelInfo } from '$lib/providers/base';
  import Pill from './Pill.svelte';
  import { supportsImageGeneration } from '$lib/utils/attachments';
  import { Archive, Brain, FileInput, Image, Search, Star, Text, Wrench, X } from 'lucide-svelte';
  import { favoriteModels } from '$lib/stores/modelPreferences';

  export let model: ModelInfo;
  export let providerInstanceId: string = '';
  export let providerIconUrl: string | undefined = undefined;
  export let isActive = false;
  export let isEnabled = true;
  export let minimal = false;
  export let mode: 'select' | 'toggle' = 'select';
  export let onclick: (() => void) | undefined = undefined;
  export let onchange: ((enabled: boolean) => void) | undefined = undefined;

  $: modelDate = model.createdAt
    ? new Date(model.createdAt * 1000).toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      })
    : null;
  $: modelFeatures = [...(model.architecture?.inputModalities || [])];
  $: isUnsupported = (() => {
    if (model.unsupported) return true; // Explicitly marked as unsupported
    if (model.architecture && model.architecture.inputModalities)
      if (
        !model.architecture?.inputModalities?.includes('text') &&
        !model.architecture?.inputModalities?.includes('image')
      )
        return true; // Unsupported input modalities
    return false;
  })();
  $: isImageGeneration = supportsImageGeneration(model);

  $: isFavorite = $favoriteModels.some((m) => m.providerInstanceId === providerInstanceId && m.modelId === model.id);

  function handleClick() {
    if (mode === 'select' && onclick) {
      onclick();
    } else if (mode === 'toggle' && onchange) {
      onchange(!isEnabled);
    }
  }

  function handleCheckboxChange(event: Event) {
    if (mode === 'toggle' && onchange) {
      const target = event.target as HTMLInputElement;
      onchange(target.checked);
    }
  }

  function handleFavoriteClick(event: MouseEvent) {
    event.stopPropagation();
    favoriteModels.toggleFavorite(providerInstanceId, model.id);
  }
</script>

<div
  class="model-item-row button button-tertiary button-large w-full !gap-2"
  class:!py-2={minimal}
  class:active={mode === 'select' && isActive}
  on:click={handleClick}
  title={model.id}
  role={mode === 'select' ? 'button' : 'none'}
  tabindex={mode === 'select' ? 0 : -1}>
  {#if mode === 'toggle'}
    <input
      type="checkbox"
      id={`model-${model.id}`}
      checked={isEnabled}
      on:change={handleCheckboxChange}
      on:click|stopPropagation />
  {/if}

  {#if mode === 'select' && providerInstanceId}
    <!-- Leading icon slot: provider icon crossfades to star on hover -->
    <button
      type="button"
      class="icon-slot"
      class:is-favorite={isFavorite}
      on:click={handleFavoriteClick}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
      <!-- Provider icon (shown by default, hidden on hover unless favorited) -->
      <span class="provider-layer" aria-hidden="true">
        {#if providerIconUrl}
          <span class="provider-icon" style="--icon: url({providerIconUrl});"></span>
        {:else}
          <span class="provider-placeholder"></span>
        {/if}
      </span>
      <!-- Star icon (shown on hover, always shown if favorited) -->
      <span class="star-layer" aria-hidden="true">
        <Star size={14} />
      </span>
    </button>
  {/if}

  <div class="min-h-6 flex-1 justify-between gap-1 text-left" class:ml-3={mode === 'toggle'} class:flex={minimal}>
    <div class="flex flex-col justify-center gap-0.5">
      <div class="text-primary flex items-center gap-2 font-medium">
        {model.name}<span class="text-secondary text-xs font-light opacity-75"> {modelDate}</span>
        {#if model.deprecated}
          <Pill icon={Archive} text="Deprecated" size="xs" variant="warning"></Pill>
        {/if}
        {#if isUnsupported}
          <Pill icon={X} text="Not supported" size="xs" variant="error"></Pill>
        {/if}
      </div>
      {#if model.description && !minimal}
        <div class="text-secondary line-clamp-4 text-xs break-words">{model.description}</div>
      {/if}
    </div>
    {#if modelFeatures.length > 0 || isImageGeneration}
      <div class="flex flex-wrap justify-end gap-1" class:mt-2={!minimal}>
        {#if modelFeatures.includes('text')}
          <Pill icon={Text} text="Text" size="sm"></Pill>
        {/if}
        {#if modelFeatures.includes('image')}
          <Pill icon={Image} text="Image" size="sm" variant="secondary"></Pill>
        {/if}
        {#if modelFeatures.includes('file')}
          <Pill icon={FileInput} text="File" size="sm" variant="success"></Pill>
        {/if}
        {#if isImageGeneration}
          <Pill icon={Image} text="Image Generation" size="sm" variant="warning"></Pill>
        {/if}
        {#if model.supportsReasoning}
          <Pill icon={Brain} text="Reasoning" size="sm" variant="special"></Pill>
        {/if}
        {#if model.supportsWebSearch}
          <Pill icon={Search} text="Web Search" size="sm" variant="error"></Pill>
        {/if}
        {#if model.supportsTools}
          <Pill icon={Wrench} text="Tool Use" size="sm" variant="cyan"></Pill>
        {/if}
      </div>
    {/if}
  </div>

  {#if model.contextWindow && !minimal}
    <div class="text-secondary hidden text-xs opacity-75 md:block">
      Context: {model.contextWindow.toLocaleString()} tokens
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "tailwindcss";

  /* ── Icon slot (leading, replaces the old trailing FavoriteButton) ── */
  .icon-slot {
    @apply relative flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded transition-colors outline-none;
    color: var(--color-a9);
  }

  /* Provider layer */
  .provider-layer {
    @apply absolute inset-0 flex items-center justify-center transition-opacity duration-150;
    opacity: 1;
  }

  .provider-icon {
    @apply block h-3.5 w-3.5;
    background-color: var(--color-a10);
    mask-position: center;
    mask-size: 100%;
    mask-repeat: no-repeat;
    mask-image: var(--icon);
  }

  .provider-placeholder {
    @apply block h-2 w-2 rounded-full;
    background-color: var(--color-a6);
  }

  /* Star layer */
  .star-layer {
    @apply absolute inset-0 flex items-center justify-center transition-opacity duration-150;
    opacity: 0;
    color: var(--color-a8);
  }

  /* On row hover: fade provider out, fade star in */
  .model-item-row:hover .icon-slot .provider-layer {
    opacity: 0;
  }

  .model-item-row:hover .icon-slot .star-layer {
    opacity: 1;
    color: var(--color-a10);
  }

  /* When favorited and hovered: show amber star instead of plain star */
  .model-item-row:hover .icon-slot.is-favorite .star-layer {
    color: #f59e0b;
  }

  /* Focus ring on the button */
  .icon-slot:focus-visible {
    @apply ring-2;
    ring-color: var(--color-a7);
  }
</style>
