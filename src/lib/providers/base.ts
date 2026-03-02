import type { Tool } from '../tools/types';
import type { MessageWithAttachments } from '../types';

export interface LanguageModel {
  id: string;
  name: string;
  stream: (
    messages: MessageWithAttachments[],
    webSearchOptions?: { enabled: boolean; searchContextSize?: 'low' | 'medium' | 'high' },
    reasoningOptions?: {
      enabled: boolean;
      effort?: 'minimal' | 'low' | 'medium' | 'high';
      summary?: 'auto' | 'concise' | 'detailed';
    },
    tools?: Tool[],
  ) => ReadableStream<string>;
  getAvailableModels: () => Promise<ModelInfo[]>;
  fallbackModel?: string;
  countTokens?: (messages: MessageWithAttachments[]) => Promise<{
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
  unsupported?: boolean; // Whether the model is unsupported (for cases where we don't yet support the model's input/output modalities or other features)
  huggingfaceId?: string;
  supportsWebSearch?: boolean; // Whether the model supports web search capabilities.
  webSearchOnlyThroughResponsesEndpoint?: boolean; // Whether web search is only available through the /v1/responses endpoint.
  supportsResponsesEndpoint?: boolean; // Whether the model supports the /v1/responses endpoint.
  supportsReasoning?: boolean; // Whether the model supports advanced reasoning capabilities.
  doesntSupportReasoningSummary?: boolean; // Whether the model doesn't support reasoning summary parameter.
  doesntSupportChatCompletionsEndpoint?: boolean; // Whether the model doesn't support the /v1/chat/completions endpoint.
  supportsTools?: boolean; // Whether the model supports function calling / tool use.
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
