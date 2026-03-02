<script lang="ts">
  import { personalizationSettings } from '$lib/settings/SettingsManager';
  import { resetTogglesToDefaults } from '$lib/stores/toggles';
  import Toggle from '$lib/components/common/Toggle.svelte';

  function update() {
    // The store is already reactive and persists via SettingsManager subscription;
    // this function just triggers the store's own subscriber.
    personalizationSettings.update((s) => ({ ...s }));
  }

  function applyDefaultsNow() {
    resetTogglesToDefaults();
  }

  function toggle(field: keyof typeof $personalizationSettings) {
    ($personalizationSettings as any)[field] = !($personalizationSettings as any)[field];
    update();
  }
</script>

<div class="panel">
  <h3>Default Toggle Values</h3>
  <p class="text-secondary text-sm opacity-75">
    These are the values the toggles start with for every new session or when creating a new chat.
  </p>

  <div class="section">
    <h4>Web Search</h4>
    <div>
      <div
        class="toggle-row"
        role="switch"
        aria-checked={$personalizationSettings.defaultWebSearchEnabled}
        tabindex="0"
        on:click={() => toggle('defaultWebSearchEnabled')}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle('defaultWebSearchEnabled')}>
        <span class="select-none">Enable web search by default</span>
        <Toggle checked={$personalizationSettings.defaultWebSearchEnabled} />
      </div>
    </div>
    <div>
      <label for="defaultWebSearchContextSize" class="text-sm select-none">Default context size</label>
      <select
        id="defaultWebSearchContextSize"
        bind:value={$personalizationSettings.defaultWebSearchContextSize}
        on:change={update}
        class="w-full">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  </div>

  <div class="section">
    <h4>Reasoning</h4>
    <div>
      <div
        class="toggle-row"
        role="switch"
        aria-checked={$personalizationSettings.defaultReasoningEnabled}
        tabindex="0"
        on:click={() => toggle('defaultReasoningEnabled')}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle('defaultReasoningEnabled')}>
        <span class="select-none">Enable reasoning by default</span>
        <Toggle checked={$personalizationSettings.defaultReasoningEnabled} />
      </div>
    </div>
    <div>
      <label for="defaultReasoningEffort" class="text-sm select-none">Default reasoning effort</label>
      <select
        id="defaultReasoningEffort"
        bind:value={$personalizationSettings.defaultReasoningEffort}
        on:change={update}
        class="w-full">
        <option value="minimal">Minimal</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
    <div>
      <label for="defaultReasoningSummary" class="text-sm select-none">Default reasoning summary</label>
      <select
        id="defaultReasoningSummary"
        bind:value={$personalizationSettings.defaultReasoningSummary}
        on:change={update}
        class="w-full">
        <option value="auto">Auto</option>
        <option value="concise">Concise</option>
        <option value="detailed">Detailed</option>
      </select>
    </div>
  </div>

  <div class="section">
    <h4>Tools</h4>
    <div>
      <div
        class="toggle-row"
        role="switch"
        aria-checked={$personalizationSettings.defaultToolUseEnabled}
        tabindex="0"
        on:click={() => toggle('defaultToolUseEnabled')}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle('defaultToolUseEnabled')}>
        <span class="select-none">Enable tool use by default</span>
        <Toggle checked={$personalizationSettings.defaultToolUseEnabled} />
      </div>
    </div>
  </div>

  <div class="section">
    <h4>Memory</h4>
    <div>
      <div
        class="toggle-row"
        role="switch"
        aria-checked={$personalizationSettings.defaultMemoryEnabled}
        tabindex="0"
        on:click={() => toggle('defaultMemoryEnabled')}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle('defaultMemoryEnabled')}>
        <span class="select-none">Enable memory by default</span>
        <Toggle checked={$personalizationSettings.defaultMemoryEnabled} />
      </div>
    </div>
  </div>

  <div class="section">
    <button class="button button-secondary" on:click={applyDefaultsNow}>
      Reset current session toggles to defaults
    </button>
    <p class="text-secondary text-xs opacity-75">Immediately applies the above defaults to the current toggle state.</p>
  </div>
</div>

<div class="panel">
  <h3>Chat Behaviour</h3>

  <div class="section">
    <h4>Restore toggles when re-opening a chat</h4>
    <div>
      <div
        class="toggle-row"
        role="switch"
        aria-checked={$personalizationSettings.restoreTogglesOnReopen}
        tabindex="0"
        on:click={() => toggle('restoreTogglesOnReopen')}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle('restoreTogglesOnReopen')}>
        <span class="select-none">Restore the last-used toggle state when switching to an existing chat</span>
        <Toggle checked={$personalizationSettings.restoreTogglesOnReopen} />
      </div>
      <p class="text-secondary text-xs opacity-75">
        When enabled, opening a chat will apply the toggles that were active the last time you sent a message in it.
        When disabled, the current toggle state is always kept as-is.
      </p>
    </div>
  </div>
</div>

<style lang="postcss">
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
  }
</style>
