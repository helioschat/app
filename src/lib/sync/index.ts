// Export sync manager and stores
export { authState, syncManager, syncSettings } from '$lib/stores/sync';

// Export API client
export { SyncAPIClient } from './api';

// Export crypto utilities
export { decryptValue, encryptValue, hashPassphrase, verifyPassphrase } from './crypto';

// Export sync hook
export { useProviderSync } from './hooks';

// Export auto-sync utilities
export {
  cleanupAutoSync,
  disableAutoSync,
  enableAutoSync,
  executeAutomaticUpdate,
  isAutoSyncEnabled,
  recordExpectedSyncValues,
} from './autoSync';

// Export thread sync utilities
export { disableThreadSync, handleIncomingThreadUpdates, syncThread, syncThreads } from './threadSync';

// Export sync types
export type {
  AuthState,
  AuthTokens,
  ChangeOperation,
  ChangesSinceResponse,
  SyncDisabledModels,
  SyncProviderInstances,
  SyncSettings,
  SyncThread,
} from '$lib/types/sync';
