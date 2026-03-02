<script lang="ts">
  import { manifest } from '$lib';
  import { Github, Heart, Zap, Shield, Clock } from 'lucide-svelte';
</script>

<div class="mx-auto max-w-4xl space-y-8 px-6 pt-4">
  <!-- Header Section -->
  <div class="header flex flex-col items-center text-center">
    <div class="mb-4 flex items-center justify-center">
      <img src="/logo.svg" alt="Helios Logo" class="h-16 w-16" />
    </div>
    <h1 class="gradient-text mb-2 text-5xl font-bold">
      {manifest.name}
    </h1>
    <p>{manifest.description}</p>
  </div>

  <!-- Key Features -->
  <div class="key-features grid gap-6 md:grid-cols-3">
    <div class="panel">
      <Shield class="icon text-green-500" />
      <h3 class="mb-2 font-semibold">Privacy First</h3>
      <p class="text-secondary text-sm">100% client-side processing. Your conversations never leave your device.</p>
    </div>
    <div class="panel">
      <Zap class="icon text-yellow-500" />
      <h3 class="mb-2 font-semibold">Blazing Fast</h3>
      <p class="text-secondary text-sm">Built with SvelteKit for a snappy, modern user experience.</p>
    </div>
    <div class="panel">
      <Clock class="icon text-blue-500" />
      <h3 class="mb-2 font-semibold">Built in 10 Days</h3>
      <p class="text-secondary text-sm">Created for the T3 Chat Cloneathon competition.</p>
    </div>
  </div>

  <!-- Competition Info -->
  <div class="competition panel">
    <h3>T3 Chat Cloneathon</h3>
    <p class="text-secondary">
      Helios was built in just 10 days for the T3 Chat Cloneathon, an open source competition to create the best clone
      of the T3 Chat product.
    </p>
    <a href="https://cloneathon.t3.chat/" target="_blank" class="button button-secondary">
      Learn More About the Competition
    </a>
  </div>

  <!-- License & Open Source -->
  <div class="license panel">
    <h3>
      <Heart class="h-6 w-6 text-red-500"></Heart>
      Open Source
    </h3>
    <p class="text-secondary">
      Helios is proudly open source and licensed under the MIT License. Feel free to contribute, fork, or learn from the
      codebase.
    </p>
    <div class="flex flex-wrap gap-2">
      <a href="https://github.com/helioschat/app" target="_blank" class="button button-secondary">
        <Github class="h-4 w-4"></Github>
        View on GitHub
      </a>
      <a href="https://github.com/helioschat/app/blob/master/LICENSE" target="_blank" class="button button-secondary">
        View License
      </a>
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .key-features :global(.icon) {
    @apply mx-auto mb-3 h-12 w-12;
  }

  .key-features .panel {
    @apply flex items-center text-center;
  }

  .gradient-text {
    background: linear-gradient(135deg, #ff4500 0%, orange 100%);
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
</style>
