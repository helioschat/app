export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
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
  provider?: string;
  model?: string;
};

export type Provider = string;

export const PROVIDER_OPENAI = 'openai';

export type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  [key: string]: string | number | boolean | undefined;
};
