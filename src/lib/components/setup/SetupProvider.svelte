<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { KNOWN_PROVIDERS } from '$lib/providers/known';
  import { addProviderInstance } from '$lib/stores/settings';

  const dispatch = createEventDispatcher<{
    continue: void;
    skip: void;
  }>();

  let name = '';
  let apiKey = '';
  let baseURL = '';
  let selectedKnownProvider: string | null = null;
  let showCustomForm = false;

  // Get the main known providers for quick setup
  const quickSetupProviders = [
    { ...KNOWN_PROVIDERS.openai, providerId: 'openai', baseUrl: 'https://api.openai.com/v1' },
    { ...KNOWN_PROVIDERS.anthropic, providerId: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
    { ...KNOWN_PROVIDERS.openrouter, providerId: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' },
    {
      ...KNOWN_PROVIDERS['google-openai'],
      providerId: 'google-openai',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    },
  ].filter((p) => p.name); // Only include providers that have metadata

  function selectKnownProvider(providerId: string) {
    const provider = quickSetupProviders.find((p) => p.providerId === providerId);
    if (provider) {
      selectedKnownProvider = providerId;
      showCustomForm = false;
      name = provider.name;
      baseURL = provider.baseUrl;
      apiKey = '';
    }
  }

  function selectCustomProvider() {
    selectedKnownProvider = null;
    showCustomForm = true;
    name = '';
    apiKey = '';
    baseURL = '';
  }

  function handleContinue() {
    if (name && apiKey && baseURL) {
      try {
        addProviderInstance(name, 'openai-compatible', {
          apiKey,
          baseURL,
          matchedProvider: selectedKnownProvider || undefined,
        });
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
    <!-- Quick Setup Options -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {#each quickSetupProviders as provider}
        <button
          class="provider-button button button-secondary button-large !h-full !gap-4 !text-left"
          class:selected={selectedKnownProvider === provider.providerId}
          on:click={() => selectKnownProvider(provider.providerId)}>
          {#if provider.icon}
            <div class="provider-icon h-8 w-8 bg-white" style="--icon: url({provider.icon});"></div>
          {/if}
          <div class="flex-1">
            <h3 class="font-semibold">{provider.name}</h3>
            {#if provider.description}
              <p class="mt-1 text-sm">{provider.description}</p>
            {/if}
          </div>
        </button>
      {/each}
    </div>

    <p class="text-secondary my-2 text-center text-xs">or configure manually</p>

    <button
      class="provider-button button button-secondary button-large !w-full !gap-4 !text-left"
      class:selected={showCustomForm}
      on:click={selectCustomProvider}>
      <div class="text-xl">⚙️</div>
      <span>Custom OpenAI-Compatible Provider</span>
    </button>

    <!-- Configuration Form -->
    {#if selectedKnownProvider !== null || showCustomForm}
      <div class="space-y-4 rounded-lg bg-[var(--color-a2)]/25 p-4">
        <div class="form-group">
          <label for="provider-name">Provider Name</label>
          <input type="text" id="provider-name" bind:value={name} placeholder="My Provider" autocomplete="off" />
        </div>

        <div class="form-group">
          <label for="api-key">API Key<span class="required-indicator">*</span></label>
          <input
            type="password"
            id="api-key"
            bind:value={apiKey}
            placeholder={selectedKnownProvider === 'openai'
              ? 'sk-proj-...'
              : selectedKnownProvider === 'anthropic'
                ? 'sk-ant-api...'
                : selectedKnownProvider === 'openrouter'
                  ? 'sk-or-v1-...'
                  : 'Your API key'}
            autocomplete="off" />
        </div>

        <div class="form-group">
          <label for="base-url">Base URL</label>
          <input
            type="text"
            id="base-url"
            bind:value={baseURL}
            placeholder="https://api.openai.com/v1"
            autocomplete="off" />
        </div>
      </div>
    {/if}
  </div>

  <div class="setup-actions">
    <button class="button button-primary" on:click={handleContinue} disabled={!canContinue}> Continue </button>
    <button class="button button-skip" on:click={() => dispatch('skip')}> Skip setup </button>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .provider-button.selected {
    @apply bg-[var(--color-a2)];
  }

  .provider-icon {
    mask-position: center;
    mask-size: 100%;
    mask-repeat: no-repeat;
    mask-image: var(--icon);
  }

  .form-group {
    @apply flex flex-col gap-2;
  }

  .form-group label {
    @apply text-sm font-medium;
  }
</style>
