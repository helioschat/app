import OpenAI from 'openai';
import type { Message, ProviderConfig } from '../types';
import type { LanguageModel, ModelInfo } from './base';
import { toReadableStream } from './base';

interface OpenAIModel extends OpenAI.Models.Model {
  name?: string;
  description?: string;
  context_length?: number;
  huggingface_id?: string;
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
      const response = await this.client.chat.completions.create({
        model: this.config.model as string,
        messages: messages.map(({ role, content }) => ({ role, content })),
        stream: true,
      });

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta as {
          content?: string;
          reasoning?: string | null;
        };

        // Handle reasoning if provided by model (e.g., :thinking models)
        if (delta?.reasoning) {
          yield `[REASONING]${delta.reasoning}`;
        }

        if (delta?.content) {
          this.tokenCount++;
          yield delta.content as string;
        }
      }
    }.bind(this)();
    return toReadableStream(gen);
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

      return response.data.map((model: OpenAIModel) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || `OpenAI-compatible model ${model.id}`,
        contextWindow: model.context_length,
        huggingfaceId: model.huggingface_id,
        createdAt: model.created,
      }));
    } catch (error) {
      // Handle API errors for model listing
      console.error('Error fetching OpenAI-compatible models:', error);
      // Fallback
      return [];
    }
  }
}
