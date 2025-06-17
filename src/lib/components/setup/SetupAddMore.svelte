<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Alert from '$lib/components/common/Alert.svelte';

  const dispatch = createEventDispatcher<{
    continue: void;
    'add-more': void;
    skip: void;
  }>();
</script>

<div class="setup-card">
  <div class="setup-header">
    <h1 class="setup-title">Great! Your first provider is configured</h1>
    <p class="setup-description">Would you like to add more providers now, or continue to start chatting?</p>
  </div>

  <div class="setup-content">
    <Alert type="success" title="Provider Added Successfully">
      <p>You can always add more providers later in the settings.</p>
    </Alert>
  </div>

  <div class="setup-actions">
    <button class="button button-primary" on:click={() => dispatch('continue')}> Continue to Chat </button>
    <button class="button button-secondary" on:click={() => dispatch('add-more')}> Add Another Provider </button>
  </div>
</div>
