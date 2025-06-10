export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  providerInstanceId?: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metrics?: {
    startTime?: number;
    endTime?: number;
    totalTime?: number;
    tokensPerSecond?: number;
  };
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  providerInstanceId?: string;
  model?: string;
  pinned?: boolean;
};

export type ProviderType = 'openai-compatible'; // | 'anthropic' | 'google-gemini' etc.

export const PROVIDER_TYPES: ProviderType[] = ['openai-compatible'];

export type ProviderConfig = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  [key: string]: string | number | boolean | undefined;
};

export type ProviderInstance = {
  id: string; // unique id for the instance
  name: string; // user-defined name
  providerType: ProviderType;
  config: ProviderConfig;
};

export type SelectedModel = {
  providerInstanceId: string;
  modelId: string;
};
