import type { MessageWithAttachments } from '$lib/types';

export interface StreamMetrics {
  startTime: number;
  endTime?: number;
  totalTime?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokensPerSecond?: number;
  thinkingTime?: number;
}

export interface StreamContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
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
    thinkingTime?: number;
  };
  reasoning?: string;
  attachmentIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamState {
  chatId: string;
  messageId: string;
  isStreaming: boolean;
  startTime: number;
  partialContent: string;
  partialReasoning: string;
  contextMessages: StreamContextMessage[];
}

export interface StreamControllerState {
  isLoading: boolean;
  currentlyStreamingMessageId: string;
}

export interface TokenCountable {
  countTokens(messages: MessageWithAttachments[]): Promise<{ promptTokens: number }>;
}
