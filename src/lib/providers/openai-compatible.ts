import { modelCache } from '$lib/stores/modelCache';
import OpenAI, { toFile } from 'openai';
import { v7 as uuidv7 } from 'uuid';
import type { Attachment, MessageWithAttachments, ProviderConfig } from '../types';
import { supportsImageGeneration } from '../utils/attachments';
import type { LanguageModel, ModelInfo } from './base';
import { toReadableStream } from './base';

interface OpenAIModel extends OpenAI.Models.Model {
  name?: string;
  display_name?: string;
  description?: string;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
  context_length?: number;
  created_at?: string;
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

      ...(config.matchedProvider === 'openrouter'
        ? {
            defaultHeaders: {
              'HTTP-Referer': 'https://heliosch.at',
              'X-Title': 'Helios',
            },
          }
        : {}),

      ...(config.matchedProvider === 'anthropic'
        ? {
            defaultHeaders: {
              'anthropic-dangerous-direct-browser-access': 'true',
              'anthropic-version': '2023-06-01',
              'x-api-key': config.apiKey,
            },
          }
        : {}),

      ...(config.matchedProvider === 'google-openai'
        ? {
            defaultHeaders: {
              'x-stainless-arch': null,
              'x-stainless-lang': null,
              'x-stainless-os': null,
              'x-stainless-package-version': null,
              'x-stainless-retry-count': null,
              'x-stainless-runtime': null,
              'x-stainless-runtime-version': null,
              'x-stainless-timeout': null,
            },
          }
        : {}),
    });
    this.config = config;
  }

  private isImageGenerationModel(): boolean {
    if (this.config.providerInstanceId && this.config.model) {
      const cachedModels = modelCache.getAllCachedModels();
      const models = cachedModels[this.config.providerInstanceId];
      if (models) {
        const model = models.find((m) => m.id === this.config.model);
        if (model) {
          return supportsImageGeneration(model);
        }
      }
    }

    return false;
  }

  stream(
    messages: MessageWithAttachments[],
    webSearchOptions?: { enabled: boolean; searchContextSize?: 'low' | 'medium' | 'high' },
  ) {
    this.tokenCount = 0;

    // Check if this is an image generation model
    if (this.isImageGenerationModel()) {
      return this.streamImageGeneration(messages);
    }

    return this.streamTextGeneration(messages, webSearchOptions);
  }

  private streamImageGeneration(messages: MessageWithAttachments[]) {
    const size = undefined; // Use defualt
    const quality = undefined; // Use default
    const n = 1; // Only generate one image

    const gen = async function* (this: OpenAICompatibleProvider) {
      const lastUserMessage = messages.filter((msg) => msg.role === 'user').pop();
      const prompt = lastUserMessage?.content || 'Generate an image';

      // Check for image attachment in the last user message
      let imageAttachment = lastUserMessage?.attachments?.find((att) => att.type.startsWith('image'));
      let hasImageAttachment = !!imageAttachment;

      // If no image attachment in last user message, recursively check previous messages
      if (!hasImageAttachment && messages.length > 1) {
        const findImageAttachment = (
          index: number,
          depth: number = 0,
        ): { attachment: Attachment | undefined; hasAttachment: boolean } => {
          if (index < 0 || depth >= 32) {
            return { attachment: undefined, hasAttachment: false };
          }

          const message = messages[index];
          if (message.error === undefined) {
            const attachment = message.attachments?.find((att) => att.type.startsWith('image'));
            if (attachment) return { attachment, hasAttachment: true };
          }

          // If it's an error message, skip to the previous one
          return findImageAttachment(index - 1, depth + 1);
        };

        const lastIndex = messages.length - 1;
        const result = findImageAttachment(lastIndex - 1);
        imageAttachment = result.attachment;
        hasImageAttachment = result.hasAttachment;
      }

      let response;
      if (hasImageAttachment) {
        if (!imageAttachment) throw new Error('No image attachment for editing');

        let imageBase64 = imageAttachment.data; // Base64 string
        const imageMimeType = imageAttachment.mimeType;
        if (imageBase64.includes(',')) {
          imageBase64 = imageBase64.split(',')[1];
        }

        // Decode base64 to binary
        const byteCharacters = atob(imageBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: imageMimeType });
        const blobFile = await toFile(blob, null, { type: imageMimeType });

        response = await this.client.images.edit({
          image: blobFile,
          prompt,
          model: this.config.model as string,
          size,
          quality,
          n,
        });
      } else {
        response = await this.client.images.generate({
          model: this.config.model as string,
          prompt,
          size,
          quality,
          n,
        });
      }

      if (response.data && response.data.length > 0) {
        const imageBase64 = response.data[0].b64_json;
        if (imageBase64) {
          const mimeType = 'image/png'; // TODO: Replace this -- Assume PNG for now

          const attachment: Attachment = {
            id: uuidv7(),
            name: hasImageAttachment ? 'Edited Image.png' : 'Generated Image.png',
            type: 'image',
            mimeType,
            data: imageBase64,
            previewUrl: `data:${mimeType};base64,${imageBase64}`,
            size: Math.round(imageBase64.length * 0.75), // TODO: Replace this -- Rough estimate of decoded size
          };
          yield JSON.stringify({ type: 'attachment', data: attachment });
        } else {
          throw new Error('No image data returned from API');
        }
      }
    }.bind(this)();

    return toReadableStream(gen);
  }

  private streamTextGeneration(
    messages: MessageWithAttachments[],
    webSearchOptions?: { enabled: boolean; searchContextSize?: 'low' | 'medium' | 'high' },
  ) {
    const gen = async function* (this: OpenAICompatibleProvider) {
      let hasFile = false;

      const mappedMessages = messages.map((message) => {
        const openaiMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
          role: message.role,
          content: message.content,
        };

        // Add attachments if present
        if (message.attachments && message.attachments.length > 0) {
          const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

          // Add text content if present
          if (message.content) {
            contentParts.push({
              type: 'text',
              text: message.content,
            });
          }

          // Add attachments
          for (const attachment of message.attachments) {
            if (attachment.type === 'image') {
              contentParts.push({
                type: 'image_url',
                image_url: {
                  url: `data:${attachment.mimeType};base64,${attachment.data}`,
                },
              });
            } else if (attachment.type === 'file') {
              // Send file as structured content part (OpenRouter compatible)
              contentParts.push({
                type: 'file',
                file: {
                  filename: attachment.name,
                  file_data: `data:${attachment.mimeType};base64,${attachment.data}`,
                },
              } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart);
              hasFile = true;
            }
          }

          if (contentParts.length > 0) {
            openaiMessage.content = contentParts;
          }
        }

        return openaiMessage;
      });

      // Determine which model to use - redirect if web search is enabled
      let modelToUse = this.config.model as string;
      if (webSearchOptions?.enabled) {
        const redirectModel = this.getWebSearchRedirectModel();
        if (redirectModel) {
          modelToUse = redirectModel;
        }
      }

      const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: modelToUse,
        messages: mappedMessages,
        stream: true,
        ...(hasFile && this.config.matchedProvider === 'openrouter' ? { plugins: [{ id: 'file-parser' }] } : {}),
        ...(webSearchOptions?.enabled
          ? {
              web_search_options: {
                search_context_size: webSearchOptions.searchContextSize || 'low',
              },
            }
          : {}),
      };

      const response = await this.client.chat.completions.create(requestOptions);

      let hasYieldedReasoning = false;
      let hasYieldedContent = false;

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta as {
          content?: string;
          reasoning?: string | null;
          reasoning_content?: string | null;
        };
        const content = delta?.content;
        const reasoning = delta?.reasoning ?? delta?.reasoning_content;

        // Handle reasoning
        if (reasoning !== undefined && reasoning !== null) {
          if (!hasYieldedReasoning && reasoning.trim().length === 0) {
            continue;
          }
          hasYieldedReasoning = true;
          yield `[REASONING]${reasoning}`;
        }

        // Handle content
        if (content !== undefined && content !== null) {
          if (!hasYieldedContent && content.trim().length === 0) {
            continue;
          }
          hasYieldedContent = true;
          this.tokenCount++;
          yield content as string;
        }
      }
    }.bind(this)();
    return toReadableStream(gen);
  }

  // Get the actual completion token count from the stream
  getCompletionTokenCount(): number {
    return this.tokenCount;
  }

  async countTokens(messages: MessageWithAttachments[]): Promise<{
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

      return response.data.map((model: OpenAIModel) => {
        const id = model.id.startsWith('models/') ? model.id.replace('models/', '') : model.id;

        return {
          id,
          name: model.name || model.display_name || id,
          description: model.description || `OpenAI-compatible model ${id}`,
          architecture: {
            inputModalities: model.architecture?.input_modalities,
            outputModalities: model.architecture?.output_modalities,
            modality: model.architecture?.modality,
          },
          contextWindow: model.context_length,
          huggingfaceId: model.huggingface_id,
          createdAt:
            model.created ||
            (() => {
              if (!model.created_at) return undefined;
              const date = new Date(model.created_at);
              if (date.getFullYear() < 2010) return undefined;
              return date.getTime() / 1000;
            })(),
        };
      });
    } catch (error) {
      // Handle API errors for model listing
      console.error('Error fetching OpenAI-compatible models:', error);
      // Fallback
      return [];
    }
  }

  private getWebSearchRedirectModel(): string | undefined {
    if (this.config.providerInstanceId && this.config.model) {
      const cachedModels = modelCache.getAllCachedModels();
      const models = cachedModels[this.config.providerInstanceId];
      if (models) {
        const model = models.find((m) => m.id === this.config.model);
        return model?.webSearchModelRedirect;
      }
    }
    return undefined;
  }
}
