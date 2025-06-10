<script lang="ts">
  import { advancedSettings } from '$lib/settings/SettingsManager';
  import { modelCache } from '$lib/stores/modelCache';

  $: currentSettings = $advancedSettings;

  function updateSettings() {
    advancedSettings.update((settings) => {
      return { ...settings };
    });
  }

  function clearModelCache() {
    modelCache.clearCache();
    alert('Model cache cleared');
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
  <p>Developer Options</p>
  <div class="flex flex-wrap gap-2">
    <button class="button button-primary" on:click={clearModelCache}>Clear model cache</button>
  </div>
</div>
