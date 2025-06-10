<script lang="ts">
  import { advancedSettings } from '$lib/settings/SettingsManager';

  $: currentSettings = $advancedSettings;

  function updateSettings() {
    advancedSettings.update((settings) => {
      return { ...settings };
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
