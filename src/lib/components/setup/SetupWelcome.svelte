<script lang="ts">
  import { manifest } from '$lib';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    continue: void;
    skip: void;
  }>();
</script>

<div class="setup-card">
  <div class="setup-header">
    <h1 class="setup-title">Welcome to {manifest.name}</h1>
    <p class="setup-description">
      Your fast, open-source chat client compatible with OpenAI, Anthropic, OpenRouter, and more. Let's get you set up
      with your first AI provider.
    </p>
  </div>

  <div class="setup-content">
    <div class="space-y-4">
      <div class="feature-item">
        <div class="feature-icon">🚀</div>
        <div class="feature-text">
          <h3>Fast & Responsive</h3>
          <p>Client-side processing and chat history</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">🔒</div>
        <div class="feature-text">
          <h3>Privacy First</h3>
          <p>Your data stays in your browser</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">🌐</div>
        <div class="feature-text">
          <h3>Multiple Providers</h3>
          <p>Support for OpenAI, Anthropic, OpenRouter, and more</p>
        </div>
      </div>
    </div>
  </div>

  <div class="setup-actions">
    <button class="button button-primary" on:click={() => dispatch('continue')}> Get Started </button>
    <button class="button button-skip" on:click={() => dispatch('skip')}> Skip setup </button>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .feature-item {
    @apply flex items-start gap-4;
  }

  .feature-icon {
    @apply text-2xl;
  }

  .feature-text h3 {
    @apply mb-1 font-semibold;
  }

  .feature-text p {
    @apply text-sm text-[var(--color-11)];
  }
</style>
