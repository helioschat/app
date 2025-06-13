import type { Message } from '../types';

export interface LanguageModel {
  id: string;
  name: string;
  stream: (messages: Message[]) => ReadableStream<string>;
  getAvailableModels: () => Promise<ModelInfo[]>;
  fallbackModel?: string;
  countTokens?: (messages: Message[]) => Promise<{
    promptTokens: number;
    completionTokens?: number;
    totalTokens: number;
  }>;
  getCompletionTokenCount: () => number;
  getModelName: () => string;
  getProviderName: () => string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  architecture?: {
    inputModalities?: string[];
    outputModalities?: string[];
    modality?: string;
  };
  createdAt?: number;
  contextWindow?: number;
  deprecated?: boolean;
  huggingfaceId?: string;
  supportsResponsesEndpoint?: boolean; // Whether the model supports the /v1/responses endpoint.
  doesntSupportChatCompletionsEndpoint?: boolean; // Whether the model doesn't support the /v1/chat/completions endpoint.
}

export interface StreamMetrics {
  startTime: number;
  endTime?: number;
  totalTime?: number;
  tokensPerSecond?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  thinkingTime?: number; // time between stream start and first content token (ms)
}

export const toReadableStream = (gen: AsyncGenerator<string, void, unknown>): ReadableStream<string> => {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await gen.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
  });
};
