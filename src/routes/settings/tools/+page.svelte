<script lang="ts">
  import Tool from '$lib/components/settings/Tool.svelte';
  import ExaSettingsModal from '$lib/components/modal/types/ExaSettingsModal.svelte';
  import { toolsSettings } from '$lib/settings/SettingsManager';
  import { Search } from 'lucide-svelte';

  let showExaModal = $state(false);

  function toggleExa() {
    toolsSettings.update((s) => ({ ...s, exa: { ...s.exa, enabled: !s.exa.enabled } }));
  }

  function saveExaSettings(event: CustomEvent<{ apiKey: string }>) {
    toolsSettings.update((s) => ({ ...s, exa: { ...s.exa, apiKey: event.detail.apiKey } }));
    showExaModal = false;
  }
</script>

<div class="space-y-2">
  <Tool
    name="Exa Search"
    description="Web search powered by Exa. Lets the model search the web for up-to-date information."
    icon={Search}
    enabled={$toolsSettings.exa.enabled}
    configured={$toolsSettings.exa.apiKey.trim().length > 0}
    onToggle={toggleExa}
    onConfigure={() => (showExaModal = true)} />
</div>

<ExaSettingsModal
  id="exa-settings-modal"
  isOpen={showExaModal}
  apiKey={$toolsSettings.exa.apiKey}
  on:close={() => (showExaModal = false)}
  on:save={saveExaSettings} />
