import type {
  APIResponse,
  AuthTokens,
  ChangesSinceResponse,
  GenerateWalletRequest,
  GenerateWalletResponse,
  LoginRequest,
  RefreshRequest,
  SyncAdvancedSettings,
  SyncDisabledModels,
  SyncMessage,
  SyncProviderInstances,
  SyncRequest,
  SyncThread,
} from '$lib/types/sync';

export class SyncAPIClient {
  private baseUrl: string;
  private accessToken?: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<APIResponse<{ status: string }>> {
    return this.request('/health');
  }

  async generateWallet(request: GenerateWalletRequest): Promise<APIResponse<GenerateWalletResponse>> {
    return this.request('/api/v1/auth/generate-wallet', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async login(request: LoginRequest): Promise<APIResponse<{ tokens: AuthTokens; user_id: string }>> {
    return this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async refresh(request: RefreshRequest): Promise<APIResponse<AuthTokens>> {
    return this.request('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Sync endpoints
  async getProviderInstances(): Promise<APIResponse<SyncProviderInstances>> {
    return this.request('/api/v1/sync/provider-instances');
  }

  async updateProviderInstances(data: SyncRequest<SyncProviderInstances>): Promise<APIResponse<SyncProviderInstances>> {
    return this.request('/api/v1/sync/provider-instances', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getDisabledModels(): Promise<APIResponse<SyncDisabledModels>> {
    return this.request('/api/v1/sync/disabled-models');
  }

  async updateDisabledModels(data: SyncRequest<SyncDisabledModels>): Promise<APIResponse<SyncDisabledModels>> {
    return this.request('/api/v1/sync/disabled-models', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAdvancedSettings(): Promise<APIResponse<SyncAdvancedSettings>> {
    return this.request('/api/v1/sync/advanced-settings');
  }

  async updateAdvancedSettings(data: SyncRequest<SyncAdvancedSettings>): Promise<APIResponse<SyncAdvancedSettings>> {
    return this.request('/api/v1/sync/advanced-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getChangesSince(timestamp: number): Promise<APIResponse<ChangesSinceResponse>> {
    return this.request(`/api/v1/sync/changes-since/${timestamp}`);
  }

  // Thread sync endpoints
  async upsertThread(threadId: string, threadData: SyncRequest<SyncThread>): Promise<APIResponse<SyncThread>> {
    return this.request(`/api/v1/sync/threads/${threadId}`, {
      method: 'PUT',
      body: JSON.stringify(threadData),
    });
  }

  // Message sync endpoints
  async upsertMessage(messageId: string, messageData: SyncRequest<SyncMessage>): Promise<APIResponse<SyncMessage>> {
    return this.request(`/api/v1/sync/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify(messageData),
    });
  }
}
