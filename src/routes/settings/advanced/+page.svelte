<script lang="ts">
  import { selectedProvider, advancedSettings } from '$lib/stores/settings';

  $: currentSettings = $advancedSettings[$selectedProvider] || $advancedSettings.default;

  function updateSettings() {
    advancedSettings.update((settings) => {
      settings[$selectedProvider] = { ...currentSettings };
      return settings;
    });
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
