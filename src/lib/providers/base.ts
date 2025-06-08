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
  contextWindow?: number;
  maxTokens?: number;
}

export interface StreamMetrics {
  startTime: number;
  endTime?: number;
  totalTime?: number;
  tokensPerSecond?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
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
