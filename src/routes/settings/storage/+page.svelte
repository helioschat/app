<script lang="ts">
  import { onMount } from 'svelte';
  import { getStorageInfo, type StorageInfo } from '$lib/database';
  import Spinner from '$lib/components/common/Spinner.svelte';
  import Pill from '$lib/components/common/Pill.svelte';
  import { HardDrive, MessageSquare, Paperclip, FileText, RefreshCw } from 'lucide-svelte';

  let storageInfo = $state<StorageInfo | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const storeLabels: Record<string, { label: string; description: string; icon: unknown }> = {
    threads: {
      label: 'Chats',
      description: 'Your conversations',
      icon: MessageSquare,
    },
    messages: {
      label: 'Messages',
      description: 'Everything said in your chats',
      icon: FileText,
    },
    attachments: {
      label: 'Attachments',
      description: "Images and files you've shared",
      icon: Paperclip,
    },
  };

  async function loadStorageInfo() {
    loading = true;
    error = null;
    try {
      storageInfo = await getStorageInfo();
    } catch (e) {
      error = 'Failed to load storage information.';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadStorageInfo();
  });

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function getUsagePercent(used: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, (used / total) * 100);
  }

  function getBarPercent(storeBytes: number, totalBytes: number): number {
    if (totalBytes === 0) return 0;
    return (storeBytes / totalBytes) * 100;
  }

  const storeColors = ['bg-blue-500', 'bg-violet-500', 'bg-orange-500'];
</script>

{#if loading}
  <div class="panel">
    <div class="flex items-center gap-2 text-sm text-gray-400">
      <Spinner />
      <span>Calculating storage usage...</span>
    </div>
  </div>
{:else if error}
  <div class="panel">
    <p class="text-sm text-red-400">{error}</p>
    <button class="button button-secondary mt-2 w-fit" onclick={loadStorageInfo}>Retry</button>
  </div>
{:else if storageInfo}
  <!-- Browser quota panel -->
  {#if storageInfo.quota !== null && storageInfo.usage !== null}
    <div class="panel">
      <h3><HardDrive size={20} />Storage</h3>

      <div class="section">
        <h4>How much space your app is using</h4>
        <div>
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="text-[var(--color-11)]">{formatBytes(storageInfo.usage)} used</span>
            <span class="text-[var(--color-11)]">{formatBytes(storageInfo.quota)} available</span>
          </div>

          <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--color-a3)]">
            <div
              class="h-full rounded-full bg-blue-500 transition-all"
              style="width: {getUsagePercent(storageInfo.usage, storageInfo.quota)}%">
            </div>
          </div>

          <p class="mt-1 text-xs text-gray-500">
            {getUsagePercent(storageInfo.usage, storageInfo.quota).toFixed(1)}% used
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Per-store breakdown panel -->
  <div class="panel">
    <div class="flex items-center justify-between">
      <h3>Chat Data Breakdown</h3>
      <button
        class="button button-secondary flex items-center gap-1.5 text-xs"
        onclick={loadStorageInfo}
        title="Refresh">
        <RefreshCw size={13} />
        Refresh
      </button>
    </div>

    <div class="section">
      <h4>What's taking up space</h4>
      <div>
        <!-- Stacked bar -->
        {#if storageInfo.totalEstimatedBytes > 0}
          <div class="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-a3)]">
            {#each storageInfo.stores as store, i}
              {@const pct = getBarPercent(store.estimatedBytes, storageInfo.totalEstimatedBytes)}
              {#if pct > 0}
                <div
                  class="{storeColors[i] ?? 'bg-gray-500'} h-full transition-all"
                  style="width: {pct}%"
                  title="{storeLabels[store.name]?.label ?? store.name}: {formatBytes(store.estimatedBytes)}">
                </div>
              {/if}
            {/each}
          </div>
        {:else}
          <div class="mb-3 h-3 w-full rounded-full bg-[var(--color-a3)]"></div>
        {/if}

        <!-- Per-store rows -->
        <div class="flex flex-col gap-2">
          {#each storageInfo.stores as store, i}
            {@const meta = storeLabels[store.name]}
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-2">
                <div class="h-2.5 w-2.5 flex-shrink-0 rounded-sm {storeColors[i] ?? 'bg-gray-500'}"></div>
                <div class="min-w-0">
                  <span class="text-sm font-medium text-[var(--color-12)]">{meta?.label ?? store.name}</span>
                  <span class="ml-1.5 text-xs text-gray-500">{meta?.description ?? ''}</span>
                </div>
              </div>
              <div class="flex flex-shrink-0 items-center gap-2">
                <Pill text={String(store.count)} variant="default" size="xs" />
                <span class="w-20 text-right text-sm text-[var(--color-11)]">{formatBytes(store.estimatedBytes)}</span>
              </div>
            </div>
          {/each}
        </div>

        <div class="mt-3 flex items-center justify-between border-t border-[var(--color-a3)] pt-3">
          <span class="text-sm font-medium text-[var(--color-12)]">Total</span>
          <span class="text-sm font-semibold text-[var(--color-12)]"
            >{formatBytes(storageInfo.totalEstimatedBytes)}</span>
        </div>

        <p class="mt-1 text-xs text-gray-500">
          These are approximate sizes (your actual usage may be slightly different).
        </p>
      </div>
    </div>
  </div>
{/if}
