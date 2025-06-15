<script lang="ts">
  import type { ModelInfo } from '$lib/providers/base';
  import Pill from './Pill.svelte';
  import { supportsImageGeneration } from '$lib/utils/attachments';

  export let model: ModelInfo;
  export let isActive = false;
  export let isEnabled = true;
  export let mode: 'select' | 'toggle' = 'select';
  export let onclick: (() => void) | undefined = undefined;
  export let onchange: ((enabled: boolean) => void) | undefined = undefined;

  $: modelFeatures = [...(model.architecture?.inputModalities || [])];
  $: isImageGeneration = supportsImageGeneration(model);

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
</script>

<div
  class="button button-secondary button-large w-full border-0 border-none select-none"
  class:active={mode === 'select' && isActive}
  on:click={handleClick}
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

  <div class="flex-1 text-left" class:ml-3={mode === 'toggle'}>
    <div class="text-primary font-medium">{model.name}</div>
    {#if model.description}
      <div class="text-secondary text-sm">{model.description}</div>
    {/if}
    {#if modelFeatures.length > 0 || isImageGeneration}
      <div class="mt-2 flex flex-wrap gap-1">
        {#if modelFeatures.includes('text')}
          <Pill text="Text" size="sm"></Pill>
        {/if}
        {#if modelFeatures.includes('image')}
          <Pill text="Image" size="sm" variant="secondary"></Pill>
        {/if}
        {#if modelFeatures.includes('file')}
          <Pill text="File" size="sm" variant="success"></Pill>
        {/if}
        {#if isImageGeneration}
          <Pill text="Image Generation" size="sm" variant="warning"></Pill>
        {/if}
      </div>
    {/if}
  </div>

  {#if model.contextWindow}
    <div class="text-sm text-gray-500">
      Context: {model.contextWindow.toLocaleString()} tokens
    </div>
  {/if}
</div>
