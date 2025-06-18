import { browser } from '$app/environment';
import { getMessagesForThread } from '$lib/database/messages';
import { getAllThreads } from '$lib/database/threads';
import type { Thread } from '$lib/database/types';
import type { AdvancedSettings } from '$lib/settings/SettingsManager';
import { SyncAPIClient } from '$lib/sync/api';
import { messageToSyncMessage, threadToSyncThread } from '$lib/sync/converters';
import { decryptValue, encryptValue, hashPassphrase } from '$lib/sync/crypto';
import type { MessageWithAttachments, ProviderInstance } from '$lib/types';
import type {
  AuthState,
  SyncAdvancedSettings,
  SyncDisabledModels,
  SyncMessage,
  SyncProviderInstances,
  SyncRequest,
  SyncSettings,
  SyncThread,
} from '$lib/types/sync';
import { get, writable } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';

class SyncManager {
  private static readonly defaultSyncSettings: SyncSettings = {
    serverUrl: '',
  };

  private static readonly defaultAuthState: AuthState = {
    isAuthenticated: false,
  };

  public readonly syncSettings = writable<SyncSettings>(this.getInitialSyncSettings());
  public readonly authState = writable<AuthState>(this.getInitialAuthState());

  private apiClient?: SyncAPIClient;
  private syncSettingsUnsubscribe?: () => void;
  private authStateUnsubscribe?: () => void;
  private machineId: string;

  constructor() {
    // Initialize machine ID
    this.machineId = this.getOrCreateMachineId();

    if (browser) {
      // Hot reload cleanup
      if (import.meta.hot) {
        import.meta.hot.dispose(() => {
          console.log('Hot reload detected - cleaning up sync manager');
          this.cleanup();
        });
      }

      this.syncSettingsUnsubscribe = this.syncSettings.subscribe((value) => {
        localStorage.setItem('syncSettings', JSON.stringify(value));
      });

      this.authStateUnsubscribe = this.authState.subscribe((value) => {
        // Persist the full auth state including tokens for seamless experience
        localStorage.setItem('authState', JSON.stringify(value));

        // Handle automatic sync based on auth state
        this.handleAuthStateChange(value);
      });

      // Initialize API client if we have a persisted authenticated state
      // Use setTimeout to avoid blocking the constructor
      setTimeout(() => {
        this.initializeFromPersistedState().catch(console.error);
      }, 0);
    }
  }

  private async initializeFromPersistedState(): Promise<void> {
    const authState = this.getInitialAuthState();

    if (authState.isAuthenticated && authState.serverUrl) {
      // Create API client for the authenticated user
      this.apiClient = new SyncAPIClient(authState.serverUrl);

      // Set access token if available
      if (authState.tokens?.access_token) {
        this.apiClient.setAccessToken(authState.tokens.access_token);

        // Check if token needs refresh on app start
        try {
          await this.ensureValidToken();
        } catch (error) {
          console.warn('Failed to refresh token on startup:', error);
          // If token refresh fails, clear auth state
          this.logout();
        }
      }
    }
  }

  private getInitialSyncSettings(): SyncSettings {
    if (browser) {
      const stored = localStorage.getItem('syncSettings');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing sync settings from localStorage', error);
        }
      }
    }
    return SyncManager.defaultSyncSettings;
  }

  private getInitialAuthState(): AuthState {
    if (browser) {
      const stored = localStorage.getItem('authState');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing auth state from localStorage', error);
        }
      }
    }
    return SyncManager.defaultAuthState;
  }

  public updateSyncSettings(settings: Partial<SyncSettings>): void {
    this.syncSettings.update((current) => ({ ...current, ...settings }));

    // Create new API client if server URL changed
    if (settings.serverUrl) {
      this.apiClient = new SyncAPIClient(settings.serverUrl);
    }
  }

  public getAPIClient(): SyncAPIClient | null {
    return this.apiClient || null;
  }

  public async generateWallet(serverUrl: string, passphrase: string): Promise<{ userId: string; createdAt: string }> {
    const client = new SyncAPIClient(serverUrl);

    // Test connection first
    await client.healthCheck();

    const response = await client.generateWallet({ passphrase });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to generate wallet');
    }

    const { uid, created_at } = response.data;
    const passphraseHash = await hashPassphrase(passphrase);

    // Update settings with new user info
    this.updateSyncSettings({
      serverUrl,
      userId: uid,
      passphraseHash,
    });

    return { userId: uid, createdAt: created_at };
  }

  public async login(serverUrl: string, userId: string, passphrase: string): Promise<void> {
    const client = new SyncAPIClient(serverUrl);

    const response = await client.login({ user_id: userId, passphrase });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Login failed');
    }

    const { tokens, user_id } = response.data;
    const passphraseHash = await hashPassphrase(passphrase);

    // Update settings and auth state
    this.updateSyncSettings({
      serverUrl,
      userId: user_id,
      passphraseHash,
    });

    this.authState.set({
      isAuthenticated: true,
      userId: user_id,
      tokens,
      serverUrl,
    });

    // Set access token for future requests
    client.setAccessToken(tokens.access_token);
    this.apiClient = client;
    // Initial upload of local threads and messages with delay to avoid DDOS
    setTimeout(() => {
      this.initialSync().catch(console.error);
    }, 0);
  }

  /**
   * Initial sync: push all local threads and their messages to the server with delays
   */
  private async initialSync(): Promise<void> {
    if (!this.apiClient) return;
    // Load local data
    const threads = await getAllThreads();
    const auth = get(this.authState);
    const settings = get(this.syncSettings);
    if (!auth.isAuthenticated || !auth.userId || !settings.passphraseHash) return;

    for (const thread of threads) {
      try {
        const syncThreadReq = await threadToSyncThread(thread, auth.userId, settings.passphraseHash);
        await this.makeAuthenticatedRequest(() => this.apiClient!.upsertThread(thread.id, syncThreadReq));
      } catch (error) {
        console.error(`Error initial syncing thread ${thread.id}:`, error);
      }
      // Delay between thread requests
      await new Promise((r) => setTimeout(r, 500));

      // Sync messages for this thread
      const messages = await getMessagesForThread(thread.id);
      for (const msg of messages) {
        try {
          const syncMsgReq = await messageToSyncMessage(msg, auth.userId, settings.passphraseHash);
          await this.makeAuthenticatedRequest(() => this.apiClient!.upsertMessage(msg.id, syncMsgReq));
        } catch (error) {
          console.error(`Error initial syncing message ${msg.id}:`, error);
        }
        // Delay between message requests
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  public async refreshToken(): Promise<void> {
    if (!this.apiClient) {
      throw new Error('No API client available');
    }

    const currentAuth = this.authState;
    let authValue: AuthState;
    const unsubscribe = currentAuth.subscribe((value) => {
      authValue = value;
    });
    unsubscribe();

    if (!authValue!.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await this.apiClient.refresh({
      refresh_token: authValue!.tokens.refresh_token,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Token refresh failed');
    }

    // Update auth state with new tokens
    this.authState.update((current) => ({
      ...current,
      tokens: response.data,
    }));

    // Update API client with new access token
    this.apiClient.setAccessToken(response.data!.access_token);
  }

  public logout(): void {
    this.authState.set(SyncManager.defaultAuthState);
    this.apiClient = undefined;
  }

  public clearSyncSettings(): void {
    this.syncSettings.set(SyncManager.defaultSyncSettings);
    this.logout();

    if (browser) {
      localStorage.removeItem('syncSettings');
      localStorage.removeItem('authState');
    }
  }

  public isTokenExpired(): boolean {
    let authValue: AuthState;
    const unsubscribe = this.authState.subscribe((value) => {
      authValue = value;
    });
    unsubscribe();

    if (!authValue!.isAuthenticated || !authValue!.tokens) {
      return true;
    }

    const expiresAt = new Date(authValue!.tokens.expires_at);
    const now = new Date();

    return expiresAt.getTime() <= now.getTime();
  }

  public async ensureValidToken(): Promise<void> {
    let authValue: AuthState;
    const unsubscribe = this.authState.subscribe((value) => {
      authValue = value;
    });
    unsubscribe();

    if (!authValue!.isAuthenticated || !authValue!.tokens) {
      throw new Error('User not authenticated');
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = new Date(authValue!.tokens.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      // Token is expired or will expire soon, refresh it
      try {
        await this.refreshToken();
      } catch {
        // If refresh fails, the user needs to log in again
        this.logout();
        throw new Error('Token refresh failed. Please log in again.');
      }
    }
  }

  public async makeAuthenticatedRequest<T>(request: () => Promise<T>): Promise<T> {
    try {
      // Ensure we have a valid token
      await this.ensureValidToken();

      // Make the request
      return await request();
    } catch (error) {
      // If the request fails due to authentication, try refreshing the token once
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        try {
          await this.refreshToken();
          // Update API client with new token after refresh
          let authValue: AuthState;
          const unsubscribe = this.authState.subscribe((value) => {
            authValue = value;
          });
          unsubscribe();

          if (this.apiClient && authValue!.tokens?.access_token) {
            this.apiClient.setAccessToken(authValue!.tokens.access_token);
          }

          return await request();
        } catch {
          // If refresh fails, user needs to log in again
          this.logout();
          throw new Error('Authentication expired. Please log in again.');
        }
      }
      throw error;
    }
  }

  public async forceTokenRefresh(): Promise<void> {
    try {
      await this.refreshToken();
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  // Provider sync methods
  public async pullProviderInstances(onUpdate?: (providers: ProviderInstance[]) => void): Promise<void> {
    if (!this.apiClient) {
      throw new Error('Not authenticated');
    }

    const syncSettings = this.getInitialSyncSettings();
    if (!syncSettings.passphraseHash) {
      throw new Error('No passphrase hash available for encryption');
    }

    return this.makeAuthenticatedRequest(async () => {
      // Get remote provider instances
      const response = await this.apiClient!.getProviderInstances();

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get provider instances');
      }

      let remoteProviders: ProviderInstance[] = [];

      // Decrypt remote providers if they exist
      if (response.data?.providers && Object.keys(response.data.providers).length > 0) {
        // TODO: Check if the update is from our own machine to prevent sync loops
        remoteProviders = await this.decryptProviderInstances(response.data.providers, syncSettings.passphraseHash!);
      }

      // Use remote providers as they are server-authoritative
      // (server handles conflict resolution)
      if (onUpdate) {
        onUpdate(remoteProviders);
      }

      // No need to push back what we just pulled!
      // The server is authoritative, so we just use what we got
    });
  }

  public async pushProviderInstances(providers: ProviderInstance[], passphraseHash: string): Promise<void> {
    if (!this.apiClient) {
      throw new Error('Not authenticated');
    }

    const syncSettings = this.getInitialSyncSettings();
    if (!syncSettings.userId) {
      throw new Error('User ID not available');
    }

    return this.makeAuthenticatedRequest(async () => {
      const encryptedProviders = await this.encryptProviderInstances(providers, passphraseHash);

      const syncData: SyncRequest<SyncProviderInstances> = {
        user_id: syncSettings.userId!,
        machine_id: this.machineId,
        data: {
          providers: encryptedProviders,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        version: 1,
      };

      const response = await this.apiClient!.updateProviderInstances(syncData);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update provider instances');
      }
    });
  }

  public async pullDisabledModels(onUpdate?: (disabledModels: Record<string, string[]>) => void): Promise<void> {
    if (!this.apiClient) {
      throw new Error('Not authenticated');
    }

    const syncSettings = this.getInitialSyncSettings();
    if (!syncSettings.passphraseHash) {
      throw new Error('No passphrase hash available for encryption');
    }

    return this.makeAuthenticatedRequest(async () => {
      // Get remote disabled models
      const response = await this.apiClient!.getDisabledModels();

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get disabled models');
      }

      let remoteDisabledModels: Record<string, string[]> = {};

      // Decrypt remote disabled models if they exist
      if (response.data?.models && Object.keys(response.data.models).length > 0) {
        // TODO: Check if the update is from our own machine to prevent sync loops
        remoteDisabledModels = await this.decryptDisabledModels(response.data.models, syncSettings.passphraseHash!);
      }

      // Use remote disabled models as they are server-authoritative
      if (onUpdate) {
        onUpdate(remoteDisabledModels);
      }

      // No need to push back what we just pulled!
      // The server is authoritative, so we just use what we got
    });
  }

  public async pushDisabledModels(disabledModels: Record<string, string[]>, passphraseHash: string): Promise<void> {
    if (!this.apiClient) {
      throw new Error('Not authenticated');
    }

    const syncSettings = this.getInitialSyncSettings();
    if (!syncSettings.userId) {
      throw new Error('User ID not available');
    }

    return this.makeAuthenticatedRequest(async () => {
      const encryptedModels = await this.encryptDisabledModels(disabledModels, passphraseHash);

      const syncData: SyncRequest<SyncDisabledModels> = {
        machine_id: this.machineId,
        user_id: syncSettings.userId!,
        data: {
          models: encryptedModels,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        version: 1,
      };

      const response = await this.apiClient!.updateDisabledModels(syncData);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update disabled models');
      }
    });
  }

  // Advanced settings sync methods
  public async pullAdvancedSettings(onUpdate?: (settings: AdvancedSettings) => void): Promise<void> {
    if (!this.apiClient) {
      throw new Error('Not authenticated');
    }

    const syncSettings = this.getInitialSyncSettings();
    if (!syncSettings.passphraseHash) {
      throw new Error('No passphrase hash available for encryption');
    }

    return this.makeAuthenticatedRequest(async () => {
      // Get remote advanced settings
      const response = await this.apiClient!.getAdvancedSettings();

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get advanced settings');
      }

      let remoteSettings: AdvancedSettings | null = null;

      // Decrypt remote settings if they exist
      if (response.data?.settings) {
        // TODO: Check if the update is from our own machine to prevent sync loops
        remoteSettings = await this.decryptAdvancedSettings(response.data.settings, syncSettings.passphraseHash!);
      }

      // Use remote settings as they are server-authoritative
      // (server handles conflict resolution)
      if (remoteSettings && onUpdate) {
        onUpdate(remoteSettings);
      }
    });
  }

  public async pushAdvancedSettings(settings: AdvancedSettings, passphraseHash: string): Promise<void> {
    if (!this.apiClient) {
      throw new Error('Not authenticated');
    }

    const syncSettings = this.getInitialSyncSettings();
    if (!syncSettings.userId) {
      throw new Error('User ID not available');
    }

    return this.makeAuthenticatedRequest(async () => {
      const encryptedSettings = await this.encryptAdvancedSettings(settings, passphraseHash);

      const syncData: SyncRequest<SyncAdvancedSettings> = {
        machine_id: this.machineId,
        user_id: syncSettings.userId!,
        data: {
          settings: encryptedSettings,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        version: 1,
      };

      const response = await this.apiClient!.updateAdvancedSettings(syncData);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update advanced settings');
      }
    });
  }

  // Encryption/decryption helpers
  private async encryptProviderInstances(
    providers: ProviderInstance[],
    passphraseHash: string,
  ): Promise<Record<string, string>> {
    const encrypted: Record<string, string> = {};

    for (const provider of providers) {
      const jsonString = JSON.stringify(provider);
      encrypted[provider.id] = await encryptValue(jsonString, passphraseHash);
    }

    return encrypted;
  }

  private async decryptProviderInstances(
    encryptedProviders: Record<string, string>,
    passphraseHash: string,
  ): Promise<ProviderInstance[]> {
    const providers: ProviderInstance[] = [];

    for (const [, encryptedValue] of Object.entries(encryptedProviders)) {
      const jsonString = await decryptValue(encryptedValue, passphraseHash);
      const provider: ProviderInstance = JSON.parse(jsonString);
      providers.push(provider);
    }

    return providers;
  }

  private async encryptDisabledModels(
    disabledModels: Record<string, string[]>,
    passphraseHash: string,
  ): Promise<Record<string, string>> {
    const encrypted: Record<string, string> = {};

    for (const [providerId, models] of Object.entries(disabledModels)) {
      const jsonString = JSON.stringify(models);
      encrypted[providerId] = await encryptValue(jsonString, passphraseHash);
    }

    return encrypted;
  }

  private async decryptDisabledModels(
    encryptedModels: Record<string, string>,
    passphraseHash: string,
  ): Promise<Record<string, string[]>> {
    const disabledModels: Record<string, string[]> = {};

    for (const [providerId, encryptedValue] of Object.entries(encryptedModels)) {
      const jsonString = await decryptValue(encryptedValue, passphraseHash);
      const models: string[] = JSON.parse(jsonString);
      disabledModels[providerId] = models;
    }

    return disabledModels;
  }

  private async encryptAdvancedSettings(
    settings: AdvancedSettings,
    passphraseHash: string,
  ): Promise<Record<string, string>> {
    const encrypted: Record<string, string> = {};

    for (const [key, value] of Object.entries(settings)) {
      const jsonString = JSON.stringify(value);
      encrypted[key] = await encryptValue(jsonString, passphraseHash);
    }

    return encrypted;
  }

  private async decryptAdvancedSettings(
    encryptedSettings: Record<string, string>,
    passphraseHash: string,
  ): Promise<AdvancedSettings> {
    const settings: Record<string, unknown> = {};

    for (const [key, encryptedValue] of Object.entries(encryptedSettings)) {
      const jsonString = await decryptValue(encryptedValue, passphraseHash);
      settings[key] = JSON.parse(jsonString);
    }

    return settings as unknown as AdvancedSettings;
  }

  // Thread sync methods
  private async decryptSyncThread(syncThread: SyncThread, passphraseHash: string): Promise<Thread> {
    // Decrypt all encrypted fields
    const title = await decryptValue(syncThread.title, passphraseHash);
    const messageCount = parseInt(await decryptValue(syncThread.messageCount, passphraseHash));
    const lastMessageDate = new Date(await decryptValue(syncThread.lastMessageDate, passphraseHash));
    const pinned = (await decryptValue(syncThread.pinned, passphraseHash)) === 'true';
    const providerInstanceId = await decryptValue(syncThread.providerInstanceId, passphraseHash);
    const model = await decryptValue(syncThread.model, passphraseHash);
    const webSearchEnabled = (await decryptValue(syncThread.webSearchEnabled, passphraseHash)) === 'true';
    const webSearchContextSize = (await decryptValue(syncThread.webSearchContextSize, passphraseHash)) as
      | 'low'
      | 'medium'
      | 'high';
    const createdAt = new Date(await decryptValue(syncThread.created_at, passphraseHash));
    const updatedAt = new Date(await decryptValue(syncThread.updated_at, passphraseHash));

    // Handle optional branchedFrom field
    let branchedFrom: { threadId: string; messageId: string } | undefined;
    if (syncThread.branchedFrom) {
      branchedFrom = JSON.parse(await decryptValue(syncThread.branchedFrom, passphraseHash));
    }

    return {
      id: syncThread.id,
      title,
      messageCount,
      lastMessageDate,
      pinned,
      providerInstanceId: providerInstanceId || undefined,
      model: model || undefined,
      branchedFrom,
      webSearchEnabled,
      webSearchContextSize,
      createdAt,
      updatedAt,
    };
  } // Message sync methods
  private async decryptSyncMessage(syncMessage: SyncMessage, passphraseHash: string): Promise<MessageWithAttachments> {
    // Decrypt basic fields
    const role = (await decryptValue(syncMessage.role, passphraseHash)) as 'user' | 'assistant' | 'system';
    const content = await decryptValue(syncMessage.content, passphraseHash);
    const createdAt = new Date(await decryptValue(syncMessage.created_at, passphraseHash));
    const updatedAt = new Date(await decryptValue(syncMessage.updated_at, passphraseHash));

    // Build the message object
    const message: MessageWithAttachments = {
      id: syncMessage.id,
      role,
      content,
      createdAt,
      updatedAt,
    };

    // Decrypt optional fields
    if (syncMessage.reasoning) {
      message.reasoning = await decryptValue(syncMessage.reasoning, passphraseHash);
    }

    if (syncMessage.providerInstanceId) {
      message.providerInstanceId = await decryptValue(syncMessage.providerInstanceId, passphraseHash);
    }

    if (syncMessage.model) {
      message.model = await decryptValue(syncMessage.model, passphraseHash);
    }

    if (syncMessage.usage) {
      try {
        message.usage = JSON.parse(await decryptValue(syncMessage.usage, passphraseHash));
      } catch (error) {
        console.error('Failed to decrypt message usage:', error);
      }
    }

    if (syncMessage.metrics) {
      try {
        message.metrics = JSON.parse(await decryptValue(syncMessage.metrics, passphraseHash));
      } catch (error) {
        console.error('Failed to decrypt message metrics:', error);
      }
    }

    if (syncMessage.error) {
      try {
        message.error = JSON.parse(await decryptValue(syncMessage.error, passphraseHash));
      } catch (error) {
        console.error('Failed to decrypt message error:', error);
      }
    }

    if (syncMessage.webSearchEnabled) {
      try {
        message.webSearchEnabled = (await decryptValue(syncMessage.webSearchEnabled, passphraseHash)) === 'true';
      } catch (error) {
        console.error('Failed to decrypt message webSearchEnabled:', error);
      }
    }

    if (syncMessage.webSearchContextSize) {
      try {
        message.webSearchContextSize = (await decryptValue(syncMessage.webSearchContextSize, passphraseHash)) as
          | 'low'
          | 'medium'
          | 'high';
      } catch (error) {
        console.error('Failed to decrypt message webSearchContextSize:', error);
      }
    }

    if (syncMessage.attachmentIds) {
      try {
        const attachmentIds: string[] = JSON.parse(await decryptValue(syncMessage.attachmentIds, passphraseHash));
        // For now, we just store the attachment IDs and let the UI load full attachments separately
        // This could be enhanced to fetch full attachment data if needed
        message.attachments = attachmentIds.map((id) => ({
          id,
          name: 'Synced Attachment',
          type: 'file' as const,
          size: 0,
          mimeType: 'application/octet-stream',
          data: '',
        }));
      } catch (error) {
        console.error('Failed to decrypt message attachmentIds:', error);
      }
    }

    return message;
  }

  /**
   * Handle incoming message updates from sync operations
   */
  private async handleIncomingMessageUpdates(
    messageUpdates: Array<{
      operation: 'add' | 'update' | 'delete';
      threadId: string;
      message?: MessageWithAttachments;
      messageId?: string;
    }>,
  ): Promise<void> {
    try {
      // Import the necessary functions from threadSync
      const { handleIncomingMessageUpdates } = await import('$lib/sync/threadSync');
      await handleIncomingMessageUpdates(messageUpdates);
    } catch (error) {
      console.error('Failed to handle incoming message updates:', error);
    }
  }

  // Automatic sync functionality
  private lastSyncTimestamp: number = 0;
  private periodicSyncInterval?: NodeJS.Timeout;
  private readonly PERIODIC_SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

  /**
   * Start automatic sync - does initial full sync and sets up periodic incremental sync
   */
  public async startAutomaticSync(
    onProviderUpdate?: (providers: ProviderInstance[]) => void | Promise<void>,
    onDisabledModelsUpdate?: (disabledModels: Record<string, string[]>) => void | Promise<void>,
    onAdvancedSettingsUpdate?: (settings: AdvancedSettings) => void | Promise<void>,
    onThreadUpdate?: (threads: Thread[]) => void | Promise<void>,
  ): Promise<void> {
    if (!this.apiClient) {
      throw new Error('Not authenticated');
    }

    // Do initial full sync
    await this.performInitialSync(onProviderUpdate, onDisabledModelsUpdate, onAdvancedSettingsUpdate, onThreadUpdate);

    // Set up periodic incremental sync
    this.setupPeriodicSync(onProviderUpdate, onDisabledModelsUpdate, onAdvancedSettingsUpdate, onThreadUpdate);
  }

  /**
   * Stop automatic sync
   */
  public stopAutomaticSync(): void {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = undefined;
    }
  }

  /**
   * Perform initial full sync on login/page load
   */
  private async performInitialSync(
    onProviderUpdate?: (providers: ProviderInstance[]) => void | Promise<void>,
    onDisabledModelsUpdate?: (disabledModels: Record<string, string[]>) => void | Promise<void>,
    onAdvancedSettingsUpdate?: (settings: AdvancedSettings) => void | Promise<void>,
    onThreadUpdate?: (threads: Thread[]) => void | Promise<void>,
  ): Promise<void> {
    try {
      // Pull provider instances, disabled models, and advanced settings
      await Promise.all([
        this.pullProviderInstances(onProviderUpdate),
        this.pullDisabledModels(onDisabledModelsUpdate),
        this.pullAdvancedSettings(onAdvancedSettingsUpdate),
      ]);

      // Note: Thread sync is handled via changes-since endpoint in incremental sync
      // onThreadUpdate is used in periodic sync operations
      if (onThreadUpdate) {
        // Initial thread sync will be handled by the first incremental sync
        console.log('Thread update callback registered for periodic sync');
      }

      // Update last sync timestamp to current time
      this.lastSyncTimestamp = Date.now();

      console.log('Initial sync completed successfully');
    } catch (error) {
      console.error('Initial sync failed:', error);
      throw error;
    }
  }

  /**
   * Set up periodic incremental sync using changes-since endpoint
   */
  private setupPeriodicSync(
    onProviderUpdate?: (providers: ProviderInstance[]) => void | Promise<void>,
    onDisabledModelsUpdate?: (disabledModels: Record<string, string[]>) => void | Promise<void>,
    onAdvancedSettingsUpdate?: (settings: AdvancedSettings) => void | Promise<void>,
    onThreadUpdate?: (threads: Thread[]) => void | Promise<void>,
  ): void {
    this.periodicSyncInterval = setInterval(async () => {
      try {
        await this.performIncrementalSync(
          onProviderUpdate,
          onDisabledModelsUpdate,
          onAdvancedSettingsUpdate,
          onThreadUpdate,
        );
      } catch (error) {
        console.error('Periodic sync failed:', error);
        // Don't throw - we don't want to crash the app if sync fails
      }
    }, this.PERIODIC_SYNC_INTERVAL_MS);
  }

  /**
   * Perform incremental sync using changes-since endpoint
   */
  private async performIncrementalSync(
    onProviderUpdate?: (providers: ProviderInstance[]) => void | Promise<void>,
    onDisabledModelsUpdate?: (disabledModels: Record<string, string[]>) => void | Promise<void>,
    onAdvancedSettingsUpdate?: (settings: AdvancedSettings) => void | Promise<void>,
    onThreadUpdate?: (threads: Thread[]) => void | Promise<void>,
  ): Promise<void> {
    if (!this.apiClient) {
      return; // Not authenticated, skip sync
    }

    const syncSettings = this.getInitialSyncSettings();
    if (!syncSettings.passphraseHash) {
      return; // No passphrase hash, skip sync
    }

    return this.makeAuthenticatedRequest(async () => {
      // Convert timestamp to nanoseconds as expected by the API
      const timestampNanos = this.lastSyncTimestamp;

      const response = await this.apiClient!.getChangesSince(timestampNanos);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get changes since last sync');
      }

      const changes = response.data;
      if (!changes) {
        return; // No changes
      }

      // Update sync timestamp first
      if (changes.sync_timestamp) {
        this.lastSyncTimestamp = new Date(changes.sync_timestamp).getTime();
      }

      // Process full data updates if present (for initial sync)
      if (changes.provider_instances) {
        const { recordExpectedSyncValues } = await import('$lib/sync/autoSync');
        const remoteProviders = await this.decryptProviderInstances(
          changes.provider_instances.providers,
          syncSettings.passphraseHash!,
        );
        if (onProviderUpdate) {
          recordExpectedSyncValues(remoteProviders, undefined);
          await onProviderUpdate(remoteProviders);
        }
      }

      if (changes.disabled_models) {
        const { recordExpectedSyncValues } = await import('$lib/sync/autoSync');
        const remoteDisabledModels = await this.decryptDisabledModels(
          changes.disabled_models.models,
          syncSettings.passphraseHash!,
        );
        if (onDisabledModelsUpdate) {
          recordExpectedSyncValues(undefined, remoteDisabledModels);
          await onDisabledModelsUpdate(remoteDisabledModels);
        }
      }

      if (changes.advanced_settings) {
        const { recordExpectedSyncValues } = await import('$lib/sync/autoSync');
        const remoteAdvancedSettings = await this.decryptAdvancedSettings(
          changes.advanced_settings.settings,
          syncSettings.passphraseHash!,
        );
        if (onAdvancedSettingsUpdate) {
          recordExpectedSyncValues(undefined, undefined, remoteAdvancedSettings);
          await onAdvancedSettingsUpdate(remoteAdvancedSettings);
        }
      }

      // Process thread updates if present (for initial sync)
      if (changes.threads && changes.threads.length > 0 && onThreadUpdate) {
        const processedThreads: Thread[] = [];

        for (const syncThread of changes.threads) {
          try {
            // TODO: Check if the update is from our own machine to prevent sync loops

            // Decrypt the thread
            const decryptedThread = await this.decryptSyncThread(syncThread, syncSettings.passphraseHash!);
            processedThreads.push(decryptedThread);
          } catch (error) {
            console.error(`Failed to decrypt thread ${syncThread.id}:`, error);
          }
        }

        // Update all processed threads at once
        if (processedThreads.length > 0) {
          console.log(`Processing ${processedThreads.length} threads from changes-since response`);
          await onThreadUpdate(processedThreads);
        }
      }

      // Process incremental operations if present
      if (changes.operations && changes.operations.length > 0) {
        await this.processChangeOperations(
          changes.operations,
          syncSettings.passphraseHash!,
          onProviderUpdate,
          onDisabledModelsUpdate,
          onAdvancedSettingsUpdate,
          onThreadUpdate,
        );
      }
    });
  }

  /**
   * Process individual change operations from incremental sync
   */
  private async processChangeOperations(
    operations: Array<{
      resource: string;
      operation: string;
      id: string;
      data?: Record<string, unknown>;
      timestamp: string;
    }>,
    passphraseHash: string,
    onProviderUpdate?: (providers: ProviderInstance[]) => void | Promise<void>,
    onDisabledModelsUpdate?: (disabledModels: Record<string, string[]>) => void | Promise<void>,
    onAdvancedSettingsUpdate?: (settings: AdvancedSettings) => void | Promise<void>,
    onThreadUpdate?: (threads: Thread[]) => void | Promise<void>,
  ): Promise<void> {
    const { recordExpectedSyncValues } = await import('$lib/sync/autoSync');

    // Group operations by resource type
    const providerOperations = operations.filter((op) => op.resource === 'provider_instances');
    const modelOperations = operations.filter((op) => op.resource === 'disabled_models');
    const threadOperations = operations.filter((op) => op.resource === 'thread');

    // Process provider operations using data directly from operations
    if (providerOperations.length > 0 && onProviderUpdate) {
      for (const operation of providerOperations) {
        if (operation.data && (operation.operation === 'add' || operation.operation === 'update')) {
          // Extract the provider instances data from the operation
          const syncData = operation.data as unknown as SyncProviderInstances;
          if (syncData.providers) {
            // Decrypt the provider instances directly from operation data
            const decryptedProviders = await this.decryptProviderInstances(syncData.providers, passphraseHash);

            // Pre-record and update
            recordExpectedSyncValues(decryptedProviders, undefined);
            await onProviderUpdate(decryptedProviders);
          }
        }
      }
    }

    // Process disabled model operations using data directly from operations
    if (modelOperations.length > 0 && onDisabledModelsUpdate) {
      for (const operation of modelOperations) {
        if (operation.data && (operation.operation === 'add' || operation.operation === 'update')) {
          // Extract the disabled models data from the operation
          const syncData = operation.data as unknown as SyncDisabledModels;
          if (syncData.models) {
            // Decrypt the disabled models directly from operation data
            const decryptedModels = await this.decryptDisabledModels(syncData.models, passphraseHash);

            // Pre-record and update
            recordExpectedSyncValues(undefined, decryptedModels);
            await onDisabledModelsUpdate(decryptedModels);
          }
        }
      }
    }

    // Process advanced settings operations using data directly from operations
    const advancedSettingsOperations = operations.filter((op) => op.resource === 'advanced_settings');
    if (advancedSettingsOperations.length > 0 && onAdvancedSettingsUpdate) {
      for (const operation of advancedSettingsOperations) {
        if (operation.data && (operation.operation === 'add' || operation.operation === 'update')) {
          // Extract the advanced settings data from the operation
          const syncData = operation.data as unknown as SyncAdvancedSettings;
          if (syncData.settings) {
            // Decrypt the advanced settings directly from operation data
            const decryptedSettings = await this.decryptAdvancedSettings(syncData.settings, passphraseHash);

            // Pre-record and update
            recordExpectedSyncValues(undefined, undefined, decryptedSettings);
            await onAdvancedSettingsUpdate(decryptedSettings);
          }
        }
      }
    }

    // Process thread operations using data directly from operations
    if (threadOperations.length > 0 && onThreadUpdate) {
      const processedThreads: Thread[] = [];

      for (const operation of threadOperations) {
        if (operation.data && (operation.operation === 'add' || operation.operation === 'update')) {
          try {
            // Extract the thread data from the operation
            const syncThread = operation.data as unknown as SyncThread;

            // Decrypt the thread
            const decryptedThread = await this.decryptSyncThread(syncThread, passphraseHash);
            processedThreads.push(decryptedThread);

            console.log(`Processed sync thread operation: ${operation.operation} for thread ${syncThread.id}`);
          } catch (error) {
            console.error(`Failed to process thread operation for ${operation.id}:`, error);
          }
        }
      }

      // Update all processed threads at once
      if (processedThreads.length > 0) {
        console.log(`Updating ${processedThreads.length} threads from sync operations`);
        await onThreadUpdate(processedThreads);
      }
    }

    // Process message operations
    const messageOperations = operations.filter((op) => op.resource === 'message');
    if (messageOperations.length > 0) {
      console.log(`Processing ${messageOperations.length} message operations from sync`);

      const messageUpdates: Array<{
        operation: 'add' | 'update' | 'delete';
        threadId: string;
        message?: MessageWithAttachments;
        messageId?: string;
      }> = [];

      for (const operation of messageOperations) {
        try {
          if (operation.operation === 'delete') {
            // Handle message deletion
            let threadId = 'unknown';
            if (operation.data) {
              const syncMessage = operation.data as unknown as SyncMessage;
              if (syncMessage.threadId) {
                threadId = await decryptValue(syncMessage.threadId, passphraseHash);
              } else if (syncMessage.thread_id) {
                // Fallback to unencrypted field if available
                threadId = syncMessage.thread_id;
              }
            }

            messageUpdates.push({
              operation: 'delete',
              threadId,
              messageId: operation.id,
            });
            console.log(`Processed sync message deletion: ${operation.id} from thread ${threadId}`);
          } else if (operation.data && (operation.operation === 'add' || operation.operation === 'update')) {
            // Handle message add/update
            const syncMessage = operation.data as unknown as SyncMessage;
            const decryptedMessage = await this.decryptSyncMessage(syncMessage, passphraseHash);

            // Decrypt the threadId field
            const threadId = await decryptValue(syncMessage.threadId, passphraseHash);

            messageUpdates.push({
              operation: operation.operation as 'add' | 'update',
              threadId,
              message: decryptedMessage,
            });
            console.log(`Processed sync message ${operation.operation}: ${syncMessage.id} in thread ${threadId}`);
          }
        } catch (error) {
          console.error(`Failed to process message operation for ${operation.id}:`, error);
        }
      }

      // Apply message updates to the local store/database
      if (messageUpdates.length > 0) {
        await this.handleIncomingMessageUpdates(messageUpdates);
      }
    }
  }

  /**
   * Get the last sync timestamp
   */
  public getLastSyncTimestamp(): number {
    return this.lastSyncTimestamp;
  }

  /**
   * Check if periodic sync is active
   */
  public isPeriodicSyncActive(): boolean {
    return !!this.periodicSyncInterval;
  }

  private async handleAuthStateChange(authState: AuthState): Promise<void> {
    if (authState.isAuthenticated) {
      // User just logged in - start automatic sync
      try {
        // Import here to avoid circular dependencies
        const { settingsManager } = await import('$lib/settings/SettingsManager');

        await this.startAutomaticSync(
          async (providers) => {
            // Pre-record the value we're about to set to prevent auto-sync
            await this.recordSyncValue('providers', providers);
            settingsManager.providerInstances.set(providers);
          },
          async (disabledModels) => {
            // Pre-record the value we're about to set to prevent auto-sync
            await this.recordSyncValue('disabledModels', disabledModels);
            settingsManager.disabledModels.set(disabledModels);
          },
          async (advancedSettings) => {
            // Pre-record the value we're about to set to prevent auto-sync
            await this.recordSyncValue('advancedSettings', advancedSettings);
            settingsManager.advancedSettings.set(advancedSettings);
          },
          async (threads) => {
            // Handle incoming thread updates from sync server
            const { handleIncomingThreadUpdates } = await import('$lib/sync/threadSync');
            await handleIncomingThreadUpdates(threads);
          },
        );
      } catch (error) {
        console.error('Failed to start automatic sync:', error);
        // Don't throw - sync failure shouldn't break login
      }
    } else {
      // User logged out - stop automatic sync
      this.stopAutomaticSync();
    }
  } /**
   * Record a value that's about to be set via sync to prevent auto-sync loops
   */
  private async recordSyncValue(
    type: 'providers' | 'disabledModels' | 'advancedSettings',
    value: unknown,
  ): Promise<void> {
    // Import dynamically to avoid circular dependencies
    const { recordExpectedSyncValues } = await import('$lib/sync/autoSync');

    if (type === 'providers') {
      recordExpectedSyncValues(value, undefined, undefined);
    } else if (type === 'disabledModels') {
      recordExpectedSyncValues(undefined, value, undefined);
    } else {
      recordExpectedSyncValues(undefined, undefined, value);
    }
  }

  /**
   * Cleanup method for hot reloads and component destruction
   */
  public cleanup(): void {
    this.stopAutomaticSync();
    this.apiClient = undefined;

    // Clean up subscriptions
    if (this.syncSettingsUnsubscribe) {
      this.syncSettingsUnsubscribe();
      this.syncSettingsUnsubscribe = undefined;
    }

    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
      this.authStateUnsubscribe = undefined;
    }
  }

  private getOrCreateMachineId(): string {
    if (!browser) {
      // Generate a temporary machine ID for server-side rendering
      return uuidv7();
    }

    const stored = localStorage.getItem('machineId');
    if (stored) {
      return stored;
    }

    const newMachineId = uuidv7();
    localStorage.setItem('machineId', newMachineId);
    return newMachineId;
  }

  public getMachineId(): string {
    return this.machineId;
  }
}

export const syncManager = new SyncManager();
export const { syncSettings, authState } = syncManager;
