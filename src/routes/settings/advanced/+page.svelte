<script lang="ts">
  import { selectedModel, advancedSettings } from '$lib/settings/SettingsManager';

  // TODO: replace default string
  $: currentSettings = $advancedSettings[$selectedModel?.providerInstanceId || 'default'] || $advancedSettings.default;

  function updateSettings() {
    advancedSettings.update((settings) => {
      // TODO: replace default string
      settings[$selectedModel?.providerInstanceId || 'default'] = { ...currentSettings };
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
