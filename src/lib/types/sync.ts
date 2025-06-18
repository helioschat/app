export interface GenerateWalletRequest {
  passphrase: string;
}

export interface GenerateWalletResponse {
  uid: string;
  created_at: string;
}

export interface LoginRequest {
  user_id: string;
  passphrase: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface APIError {
  code: number;
  message: string;
  details?: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
}

export interface SyncSettings {
  serverUrl: string;
  userId?: string;
  // Secure hash of the passphrase for persistence
  passphraseHash?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  tokens?: AuthTokens;
  serverUrl?: string;
}

export interface SyncRequest<SyncData> {
  machine_id: string; // Unique ID for the machine making the request
  user_id: string; // User ID for whom the sync is being performed
  data: SyncData;
  version: number; // Version of the data being sent
}

// Sync data types
export interface SyncProviderInstances {
  providers: Record<string, string>; // Encrypted JSON values
  updated_at: string;
  created_at: string;
}

export interface SyncDisabledModels {
  models: Record<string, string>; // Encrypted JSON values
  updated_at: string;
  created_at: string;
}

export interface ChangeOperation {
  resource: string;
  operation: 'add' | 'update' | 'delete';
  id: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface ChangesSinceResponse {
  threads?: SyncThread[]; // Full thread list on initial sync
  messages?: SyncMessage[]; // Full message list on initial sync
  provider_instances?: SyncProviderInstances; // Full provider instances on initial sync
  disabled_models?: SyncDisabledModels; // Full disabled models on initial sync
  advanced_settings?: SyncAdvancedSettings; // Full advanced settings on initial sync
  operations?: ChangeOperation[]; // Incremental change operations since last sync
  sync_timestamp: string; // Server timestamp for this sync
}

export interface SyncAdvancedSettings {
  settings: Record<string, string>; // Encrypted individual setting values
  updated_at: string;
  created_at: string;
}

// Thread sync types
export interface SyncThread {
  id: string;
  title: string; // CLIENT-ENCRYPTED STRING
  messageCount: string; // CLIENT-ENCRYPTED STRING (originally int) - Number of messages in the thread
  lastMessageDate: string; // CLIENT-ENCRYPTED STRING (originally date-time) - Date of the last message in the thread
  pinned: string; // CLIENT-ENCRYPTED STRING (originally bool) - Whether the thread is pinned
  providerInstanceId: string; // CLIENT-ENCRYPTED STRING - ID of the provider instance
  model: string; // CLIENT-ENCRYPTED STRING - AI model being used
  branchedFrom?: string; // CLIENT-ENCRYPTED STRING (originally uuid) - ID of the thread this was branched from (if any)
  webSearchEnabled: string; // CLIENT-ENCRYPTED STRING (originally bool) - Whether web search is enabled for this thread
  webSearchContextSize: string; // CLIENT-ENCRYPTED STRING (originally int) - Web search context size
  updated_at: string; // CLIENT-ENCRYPTED STRING (originally date-time)
  created_at: string; // CLIENT-ENCRYPTED STRING (originally date-time)
}

// Message sync types
export interface SyncMessage {
  id: string;
  user_id: string;
  thread_id: string;
  threadId: string; // CLIENT-ENCRYPTED STRING (originally uuid.UUID)
  role: string; // CLIENT-ENCRYPTED STRING
  content: string; // CLIENT-ENCRYPTED STRING
  attachmentIds?: string; // CLIENT-ENCRYPTED STRING (originally []string)
  reasoning?: string; // CLIENT-ENCRYPTED STRING
  providerInstanceId?: string; // CLIENT-ENCRYPTED STRING
  model?: string; // CLIENT-ENCRYPTED STRING
  usage?: string; // CLIENT-ENCRYPTED STRING (originally *TokenUsage)
  metrics?: string; // CLIENT-ENCRYPTED STRING (originally *StreamMetrics)
  created_at: string; // CLIENT-ENCRYPTED STRING (originally time.Time)
  updated_at: string; // CLIENT-ENCRYPTED STRING (originally time.Time)
  error?: string; // CLIENT-ENCRYPTED STRING (originally *ChatError)
  webSearchEnabled?: string; // CLIENT-ENCRYPTED STRING (originally *bool)
  webSearchContextSize?: string; // CLIENT-ENCRYPTED STRING
  version: number;
}
