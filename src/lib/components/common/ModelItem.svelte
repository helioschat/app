<script lang="ts">
  import type { ModelInfo } from '$lib/providers/base';
  import Pill from './Pill.svelte';
  import { supportsImageGeneration } from '$lib/utils/attachments';
  import { Archive, FileInput, Image, Search, Text, X } from 'lucide-svelte';

  export let model: ModelInfo;
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
    if (model.doesntSupportChatCompletionsEndpoint) return true; // Doesn't support chat completions endpoint
    if (model.architecture && model.architecture.inputModalities)
      if (
        !model.architecture?.inputModalities?.includes('text') &&
        !model.architecture?.inputModalities?.includes('image')
      )
        return true; // Unsupported input modalities
    return false;
  })();
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
  class="button button-tertiary button-large w-full"
  class:!py-2={minimal}
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
      <div class="flex flex-wrap gap-1" class:mt-2={!minimal}>
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
        {#if model.supportsWebSearch}
          <Pill icon={Search} text="Web Search" size="sm" variant="error"></Pill>
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
