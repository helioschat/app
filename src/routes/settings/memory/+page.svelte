<script lang="ts">
  import { memories, addManualMemory, removeMemory, clearMemories } from '$lib/stores/memories';

  let newTitle = '';
  let newContent = '';
  let isAdding = false;

  async function handleAddMemory() {
    if (!newTitle.trim() || !newContent.trim()) return;
    isAdding = true;
    try {
      await addManualMemory(newTitle.trim(), newContent.trim());
      newTitle = '';
      newContent = '';
    } finally {
      isAdding = false;
    }
  }

  async function handleRemoveMemory(id: string) {
    await removeMemory(id);
  }

  async function handleClearMemories() {
    const confirmed = confirm(
      'This will permanently delete all your saved memories. This cannot be undone.\n\nAre you sure?',
    );
    if (!confirmed) return;
    await clearMemories();
  }
</script>

<div class="panel">
  <h3>Your Memories</h3>

  {#if $memories.length === 0}
    <p class="text-secondary text-sm opacity-75">No memories saved yet.</p>
  {:else}
    <div class="section">
      <div class="flex flex-col gap-2">
        {#each $memories as memory (memory.id)}
          <div class="flex items-start justify-between gap-3 rounded-md bg-[var(--color-3)] p-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{memory.title}</p>
              <p class="text-secondary mt-0.5 text-xs">{memory.content}</p>
              <p class="text-secondary mt-1 text-xs opacity-50">
                {memory.source === 'auto' ? 'Saved by model' : 'Manual'} ·
                {memory.updatedAt.toLocaleDateString()}
              </p>
            </div>
            <button
              class="button button-ghost button-small button-circle shrink-0 text-xs"
              on:click={() => handleRemoveMemory(memory.id)}
              title="Delete memory">
              Delete
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="section">
    <h4>Add Memory</h4>
    <div class="flex flex-col gap-2">
      <input type="text" bind:value={newTitle} placeholder="Title (e.g. Works as a software engineer)" class="w-full" />
      <textarea bind:value={newContent} placeholder="Details..." class="h-20 w-full resize-none"></textarea>
      <div>
        <button
          class="button button-secondary"
          disabled={!newTitle.trim() || !newContent.trim() || isAdding}
          on:click={handleAddMemory}>
          {isAdding ? 'Adding…' : 'Add Memory'}
        </button>
      </div>
    </div>
  </div>
</div>

<div class="panel">
  <h3>Danger Zone</h3>

  <div class="section">
    <h4>Clear Memories</h4>
    <div>
      <button class="button button-danger" on:click={handleClearMemories} disabled={$memories.length === 0}>
        Clear All Memories
      </button>
      <p class="text-secondary mt-1 text-xs opacity-75">
        Permanently delete all {$memories.length} saved {$memories.length === 1 ? 'memory' : 'memories'}. This cannot be
        undone.
      </p>
    </div>
  </div>
</div>
