import { browser } from '$app/environment';
import { authState, syncManager } from '$lib/stores/sync';
import type { Chat, MessageWithAttachments } from '$lib/types';
import { get } from 'svelte/store';
import { detectMessageChanges } from './detectMessageChanges';
import { processMessageChanges, processThreadChanges } from './threadProcessor';

// Message interface for sync - use the current MessageWithAttachments type

let syncDebounceTimeout: NodeJS.Timeout | null = null;
let messageSyncTimeout: NodeJS.Timeout | null = null;
// Map of message changes by message ID to dedupe updates
let messageChangeMap: Record<
  string,
  { type: 'added' | 'modified' | 'deleted'; message: MessageWithAttachments & { threadId: string } }
> = {};
// Track previous state of chats for change detection
let previousChatsState: Chat[] = [];

const THREAD_SYNC_DEBOUNCE_MS = 3000; // Wait 3 seconds after last change before syncing
const MESSAGE_SYNC_DEBOUNCE_MS = 3000;

/**
 * Ensure message sync subscription is initialized
 * Can be called from external modules to guarantee initialization
 */
export function ensureMessageSyncInitialized(): void {
  initializeMessageSync();
}

// Flag to track if message sync subscription is initialized
let isMessageSyncInitialized = false;

/**
 * Initialize message sync subscription (called lazily to avoid circular dependencies)
 */
function initializeMessageSync() {
  if (isMessageSyncInitialized || !browser) return;

  import('$lib/stores/chat')
    .then(({ chats, isInitializing }) => {
      chats.subscribe((currentChats) => {
        if (currentChats.length === 0) {
          previousChatsState = [];
          return;
        }

        const isStoreInitializing = get(isInitializing);
        if (isStoreInitializing) {
          previousChatsState = currentChats;
          return;
        }

        const auth = get(authState);
        if (!auth.isAuthenticated) {
          previousChatsState = currentChats;
          return;
        }

        const messageChanges = detectMessageChanges(previousChatsState, currentChats);

        if (messageChanges.length > 0) {
          // Accumulate and dedupe changes, then debounce processing
          messageChanges.forEach((change) => {
            messageChangeMap[change.message.id] = change;
          });
          if (messageSyncTimeout) clearTimeout(messageSyncTimeout);
          messageSyncTimeout = setTimeout(() => {
            const auth = get(authState);
            const apiClient = syncManager.getAPIClient();
            const syncSettings = get(syncManager.syncSettings);
            const queuedChanges = Object.values(messageChangeMap);
            if (
              auth.isAuthenticated &&
              auth.userId &&
              apiClient &&
              syncSettings.passphraseHash &&
              queuedChanges.length
            ) {
              void processMessageChanges(queuedChanges, auth.userId, syncSettings.passphraseHash, apiClient).catch(
                console.error,
              );
            }
            messageChangeMap = {};
          }, MESSAGE_SYNC_DEBOUNCE_MS);
        }

        previousChatsState = currentChats;
      });

      isMessageSyncInitialized = true;
    })
    .catch((error) => {
      console.error('Failed to initialize message sync:', error);
    });
}

// Initialize message sync when the module loads (with dynamic import to avoid circular deps)
if (browser) {
  // Use setTimeout to ensure all modules are loaded before initializing
  setTimeout(initializeMessageSync, 0);
}

/**
 * Manually sync a specific thread
 * Call this when a thread is created, updated, or deleted
 */
export function syncThread(chat: Chat): void {
  if (!browser) return;

  // Check if user is authenticated
  const auth = get(authState);
  if (!auth.isAuthenticated) {
    console.log('Thread sync skipped - user not authenticated');
    return;
  }

  // Skip temporary chats
  if (chat.temporary) {
    console.log('Thread sync skipped - temporary chat');
    return;
  }

  console.log(`Manually syncing thread: ${chat.id}`);
  debouncedThreadSync([chat]);
}

/**
 * Manually sync multiple threads
 */
export function syncThreads(chats: Chat[]): void {
  if (!browser) return;

  // Check if user is authenticated
  const auth = get(authState);
  if (!auth.isAuthenticated) {
    return;
  }

  // Filter out temporary chats
  const persistentChats = chats.filter((chat) => !chat.temporary);

  if (persistentChats.length === 0) {
    return;
  }

  debouncedThreadSync(persistentChats);
}

// Debounced sync function for thread changes
const debouncedThreadSync = (changedChats: Chat[]) => {
  if (syncDebounceTimeout) {
    clearTimeout(syncDebounceTimeout);
  }

  syncDebounceTimeout = setTimeout(async () => {
    const auth = get(authState);
    if (!auth.isAuthenticated) {
      return;
    }

    try {
      await processThreadChanges(changedChats);
    } catch (error) {
      console.error('Thread sync failed:', error);
    }
  }, THREAD_SYNC_DEBOUNCE_MS);
};

/**
 * Disable thread syncing (cleanup any pending operations)
 */
export function disableThreadSync(): void {
  if (syncDebounceTimeout) {
    clearTimeout(syncDebounceTimeout);
    syncDebounceTimeout = null;
  }
}

// Re-export handlers for compatibility
export { processThreadChanges } from './threadProcessor';

// Ensure these handlers are exposed for legacy imports
export { handleIncomingMessageUpdates, handleIncomingThreadUpdates } from './threadProcessor';
