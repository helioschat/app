import OpenAI from 'openai';
import { setChatError } from '../stores/error';
import type { Message, ProviderConfig } from '../types';
import type { LanguageModel, ModelInfo } from './base';
import { toReadableStream } from './base';

interface OpenAIErrorDetails {
  message: string;
  type: string;
  param: string | null;
  code: string;
}

export interface OpenAIError extends Error {
  error: OpenAIErrorDetails;
}

export class OpenAICompatibleProvider implements LanguageModel {
  private client: OpenAI;
  private config: ProviderConfig;
  public readonly id = 'openai-compatible';
  public name = 'OpenAI-Compatible';
  private tokenCount = 0;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      dangerouslyAllowBrowser: true,
    });
    this.config = config;
  }

  stream(messages: Message[]) {
    this.tokenCount = 0;

    const gen = async function* (this: OpenAICompatibleProvider) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.config.model as string,
          messages: messages.map(({ role, content }) => ({ role, content })),
          stream: true,
        });

        for await (const chunk of response) {
          // Count each chunk as a token (OpenAI streams by token)
          if (chunk.choices[0]?.delta?.content) {
            this.tokenCount++;
          }
          yield chunk.choices[0]?.delta?.content || '';
        }
      } catch (error) {
        // Handle OpenAI API errors
        if (this.isOpenAIError(error)) {
          setChatError({
            message: error.error.message,
            type: error.error.type,
            param: error.error.param,
            code: error.error.code,
            provider: this.id,
          });
        } else {
          // Handle other errors
          setChatError({
            message: error instanceof Error ? error.message : 'An unknown error occurred',
            type: 'unknown_error',
            provider: this.id,
          });
        }
        throw error;
      }
    }.bind(this)();
    return toReadableStream(gen);
  }

  private isOpenAIError(error: unknown): error is OpenAIError {
    if (!(error instanceof Error)) return false;

    const err = error as { error?: unknown };
    if (!err.error || typeof err.error !== 'object') return false;

    const details = err.error as Partial<OpenAIErrorDetails>;
    return (
      typeof details.message === 'string' &&
      typeof details.type === 'string' &&
      (details.param === null || typeof details.param === 'string') &&
      typeof details.code === 'string'
    );
  }

  // Get the actual completion token count from the stream
  getCompletionTokenCount(): number {
    return this.tokenCount;
  }

  async countTokens(messages: Message[]): Promise<{
    promptTokens: number;
    completionTokens?: number;
    totalTokens: number;
  }> {
    // For prompt tokens, we still need to estimate
    let promptTokens = 0;

    for (const message of messages) {
      promptTokens += 4;

      if (message.content) {
        // Count words and multiply by average tokens per word
        const words = message.content.split(/\s+/).length;
        const contentTokens = Math.ceil(words * 1.3);
        promptTokens += Math.max(1, contentTokens);
      }
    }

    // Add overhead tokens
    promptTokens += 3;

    return {
      promptTokens: promptTokens,
      completionTokens: this.tokenCount,
      totalTokens: promptTokens + this.tokenCount,
    };
  }

  getModelName(): string {
    return this.config.model || 'unknown';
  }

  getProviderName(): string {
    return this.name;
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.models.list();

      return response.data.map((model) => ({
        id: model.id,
        name: model.id,
        description: `OpenAI-compatible model ${model.id}`,
      }));
    } catch (error) {
      // Handle API errors for model listing
      if (this.isOpenAIError(error)) {
        setChatError({
          message: error.error.message,
          type: error.error.type,
          param: error.error.param,
          code: error.error.code,
          provider: this.id,
        });
      }
      console.error('Error fetching OpenAI-compatible models:', error);
      // Fallback
      return [];
    }
  }
}
