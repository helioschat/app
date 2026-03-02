import { modelCache } from '$lib/stores/modelCache';
import OpenAI, { toFile } from 'openai';
import { v7 as uuidv7 } from 'uuid';
import type { Tool } from '../tools/types';
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
  supported_parameters?: string[];
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
    reasoningOptions?: {
      enabled: boolean;
      effort?: 'minimal' | 'low' | 'medium' | 'high';
      summary?: 'auto' | 'concise' | 'detailed';
    },
    tools?: Tool[],
  ) {
    this.tokenCount = 0;

    // Check if this is an image generation model
    if (this.isImageGenerationModel()) {
      return this.streamImageGeneration(messages);
    }

    return this.streamTextGeneration(messages, webSearchOptions, reasoningOptions, tools);
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
    reasoningOptions?: {
      enabled: boolean;
      effort?: 'minimal' | 'low' | 'medium' | 'high';
      summary?: 'auto' | 'concise' | 'detailed';
    },
    tools?: Tool[],
  ) {
    // Check if model supports responses endpoint
    const supportsResponses = this.supportsResponsesEndpoint();

    if (supportsResponses) {
      return this.streamResponsesEndpoint(messages, webSearchOptions, reasoningOptions, tools);
    }

    return this.streamChatCompletions(messages, webSearchOptions, reasoningOptions, tools);
  }

  private streamChatCompletions(
    messages: MessageWithAttachments[],
    webSearchOptions?: { enabled: boolean; searchContextSize?: 'low' | 'medium' | 'high' },
    reasoningOptions?: {
      enabled: boolean;
      effort?: 'minimal' | 'low' | 'medium' | 'high';
      summary?: 'auto' | 'concise' | 'detailed';
    },
    tools?: Tool[],
  ) {
    const gen = async function* (this: OpenAICompatibleProvider) {
      let hasFile = false;

      const mapMessages = (msgs: MessageWithAttachments[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] =>
        msgs.map((message) => {
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

      // Build the conversation history for the provider.
      // This array grows when tool calls are executed (agentic loop).
      const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = mapMessages(messages);

      const toolDefinitions = tools && tools.length > 0 ? tools.map((t) => t.definition) : undefined;

      // If tools are provided, inject a note into the system prompt so the model
      // reliably knows to use them.  We append to an existing system message if
      // one is present, otherwise prepend a new one.
      if (toolDefinitions && toolDefinitions.length > 0) {
        const toolNames = toolDefinitions.map((t) => t.function.name).join(', ');
        const toolNotice = `You have access to the following tools: ${toolNames}. Use them whenever they would help answer the user's request accurately.`;
        const systemIdx = conversationMessages.findIndex((m) => m.role === 'system');
        if (systemIdx !== -1) {
          const existing = conversationMessages[systemIdx];
          const existingContent = typeof existing.content === 'string' ? existing.content : '';
          conversationMessages[systemIdx] = {
            role: 'system',
            content: existingContent ? `${existingContent}\n\n${toolNotice}` : toolNotice,
          };
        } else {
          conversationMessages.unshift({ role: 'system', content: toolNotice });
        }
      }

      // Check if reasoning should be enabled for OpenRouter models
      const shouldEnableOpenRouterReasoning =
        reasoningOptions?.enabled && this.config.matchedProvider === 'openrouter' && this.supportsReasoning();

      // Agentic loop: keep calling the model until it produces a final text response
      // with no more tool calls (or until a safety iteration limit is hit).
      const MAX_TOOL_ITERATIONS = 10;
      let iteration = 0;

      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;

        const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
          model: this.config.model as string,
          messages: conversationMessages,
          stream: true,
          ...(hasFile && this.config.matchedProvider === 'openrouter' ? { plugins: [{ id: 'file-parser' }] } : {}),
          ...(webSearchOptions?.enabled
            ? {
                web_search_options: {
                  search_context_size: webSearchOptions.searchContextSize || 'low',
                },
              }
            : {}),
          ...(shouldEnableOpenRouterReasoning
            ? {
                reasoning: {
                  // Map effort levels to OpenRouter format (high/medium/low)
                  effort: reasoningOptions.effort === 'minimal' ? 'low' : reasoningOptions.effort || 'medium',
                  exclude: false, // Always include reasoning tokens in response
                },
              }
            : {}),
          ...(toolDefinitions ? { tools: toolDefinitions, tool_choice: 'auto' } : {}),
        };

        const response = await this.client.chat.completions.create(requestOptions);

        let hasYieldedReasoning = false;
        let hasYieldedContent = false;

        // Accumulate tool call deltas (index → {id, name, arguments})
        const toolCallAccumulator: Record<number, { id: string; name: string; arguments: string }> = {};

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta as {
            content?: string;
            reasoning?: string | null;
            reasoning_content?: string | null;
            tool_calls?: Array<{
              index: number;
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };

          const content = delta?.content;
          const reasoning = delta?.reasoning ?? delta?.reasoning_content;

          // Handle reasoning
          if (reasoning !== undefined && reasoning !== null) {
            if (!hasYieldedReasoning && reasoning.trim().length === 0) {
              continue;
            }
            hasYieldedReasoning = true;
            this.tokenCount++;
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

          // Accumulate tool call deltas
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallAccumulator[tc.index]) {
                toolCallAccumulator[tc.index] = { id: '', name: '', arguments: '' };
              }
              if (tc.id) toolCallAccumulator[tc.index].id += tc.id;
              if (tc.function?.name) toolCallAccumulator[tc.index].name += tc.function.name;
              if (tc.function?.arguments) toolCallAccumulator[tc.index].arguments += tc.function.arguments;
            }
          }
        }

        // Check if there are any tool calls to process
        const pendingToolCalls = Object.values(toolCallAccumulator);
        if (pendingToolCalls.length === 0) {
          // No tool calls → final response, exit the loop
          break;
        }

        // Resolve IDs once so the assistant message and tool result messages
        // reference the same ID (both calls to uuidv7() would produce different values).
        const resolvedToolCalls = pendingToolCalls.map((tc) => ({
          ...tc,
          id: tc.id || uuidv7(),
        }));

        // Emit a stream event so the StreamProcessor can record the tool calls
        yield JSON.stringify({ type: 'tool_calls', data: resolvedToolCalls });

        // Add the assistant's tool call message to the conversation
        conversationMessages.push({
          role: 'assistant',
          content: null,
          tool_calls: resolvedToolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        });

        // Execute each tool call and add results to the conversation
        for (const tc of resolvedToolCalls) {
          const toolId = tc.id;
          const tool = tools?.find((t) => t.definition.function.name === tc.name);
          let resultJson: string;

          if (tool) {
            try {
              const result = await tool.execute(tc.arguments);
              resultJson = JSON.stringify(result);
            } catch (err) {
              resultJson = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
            }
          } else {
            resultJson = JSON.stringify({ error: `Unknown tool: ${tc.name}` });
          }

          // Emit so StreamProcessor can surface the result in the UI
          yield JSON.stringify({
            type: 'tool_result',
            data: {
              toolCallId: toolId,
              name: tc.name,
              result: resultJson,
            },
          });

          // Add tool result to conversation history
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolId,
            content: resultJson,
          });
        }
        // Continue the loop — re-send the full conversation with tool results
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
          // Detect tool support from OpenRouter-style supported_parameters array
          ...(model.supported_parameters ? { supportsTools: model.supported_parameters.includes('tools') } : {}),
        };
      });
    } catch (error) {
      // Handle API errors for model listing
      console.error('Error fetching OpenAI-compatible models:', error);
      // Fallback
      return [];
    }
  }

  private supportsResponsesEndpoint(): boolean {
    if (this.config.providerInstanceId && this.config.model) {
      const cachedModels = modelCache.getAllCachedModels();
      const models = cachedModels[this.config.providerInstanceId];
      if (models) {
        const model = models.find((m) => m.id === this.config.model);
        return model?.supportsResponsesEndpoint === true;
      }
    }
    return false;
  }

  private supportsReasoning(): boolean {
    if (this.config.providerInstanceId && this.config.model) {
      const cachedModels = modelCache.getAllCachedModels();
      const models = cachedModels[this.config.providerInstanceId];
      if (models) {
        const model = models.find((m) => m.id === this.config.model);
        return model?.supportsReasoning === true;
      }
    }
    return false;
  }

  private supportsReasoningSummary(): boolean {
    if (this.config.providerInstanceId && this.config.model) {
      const cachedModels = modelCache.getAllCachedModels();
      const models = cachedModels[this.config.providerInstanceId];
      if (models) {
        const model = models.find((m) => m.id === this.config.model);
        return model?.doesntSupportReasoningSummary !== true;
      }
    }
    return true; // Default to supporting summary if not specified
  }

  private streamResponsesEndpoint(
    messages: MessageWithAttachments[],
    webSearchOptions?: { enabled: boolean; searchContextSize?: 'low' | 'medium' | 'high' },
    reasoningOptions?: {
      enabled: boolean;
      effort?: 'minimal' | 'low' | 'medium' | 'high';
      summary?: 'auto' | 'concise' | 'detailed';
    },
    tools?: Tool[],
  ) {
    const gen = async function* (this: OpenAICompatibleProvider) {
      // Convert tool definitions to Responses API FunctionTool format
      const responsesToolDefs =
        tools && tools.length > 0
          ? tools.map((t) => ({
              type: 'function' as const,
              name: t.definition.function.name,
              description: t.definition.function.description ?? null,
              parameters: (t.definition.function.parameters as Record<string, unknown>) ?? null,
              strict: null,
            }))
          : undefined;

      // Extract instructions and build input array from message history.
      // This array grows with function_call / function_call_output items in the agentic loop.
      let instructions = '';
      const input: Array<{ type: 'message' | 'function_call' | 'function_call_output'; [key: string]: unknown }> = [];

      for (const message of messages) {
        if (message.role === 'system') {
          instructions = message.content;
          continue;
        }

        if (message.role === 'user') {
          const content: Array<{ type: string; [k: string]: unknown }> = [];

          if (message.content) {
            content.push({ type: 'input_text', text: message.content });
          }

          if (message.attachments && message.attachments.length > 0) {
            for (const attachment of message.attachments) {
              if (attachment.type === 'image') {
                content.push({
                  type: 'input_image',
                  image_url: `data:${attachment.mimeType};base64,${attachment.data}`,
                });
              } else if (attachment.type === 'file') {
                content.push({
                  type: 'input_file',
                  filename: attachment.name,
                  file_data: `data:${attachment.mimeType};base64,${attachment.data}`,
                });
              }
            }
          }

          input.push({ type: 'message', role: 'user', content });
        } else if (message.role === 'assistant') {
          input.push({
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: message.content, annotations: [] }],
          });
        }
      }

      // Check if reasoning should be enabled (only for OpenAI provider and if model supports it)
      const shouldEnableReasoning =
        reasoningOptions?.enabled && this.config.matchedProvider === 'openai' && this.supportsReasoning();

      // Agentic loop: keep calling until no more function calls
      const MAX_TOOL_ITERATIONS = 10;
      let iteration = 0;

      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;

        // Merge web search tool with function tools for this request
        const webSearchTool = webSearchOptions?.enabled ? { type: 'web_search_preview' } : null;
        const allTools = [...(webSearchTool ? [webSearchTool] : []), ...(responsesToolDefs ?? [])];

        const requestOptions = {
          model: this.config.model as string,
          input: input as unknown[],
          stream: true as const,
          ...(instructions ? { instructions } : {}),
          ...(allTools.length > 0 ? { tools: allTools } : {}),
          ...(shouldEnableReasoning
            ? {
                include: ['reasoning.encrypted_content'],
                reasoning: {
                  effort: reasoningOptions!.effort || 'medium',
                  ...(this.supportsReasoningSummary() ? { summary: reasoningOptions!.summary || 'auto' } : {}),
                },
              }
            : {}),
        };

        // Use OpenAI SDK responses endpoint with proper typing
        const response = await (this.client.responses.create as (params: typeof requestOptions) => Promise<unknown>)(
          requestOptions,
        );

        let currentReasoningText = '';
        let currentReasoningSummaryText = '';

        // Accumulate function call arguments streaming (call_id → arguments)
        const functionCallAccumulator: Record<
          string,
          { call_id: string; name: string; arguments: string; item_id?: string }
        > = {};

        let pendingFunctionCallItems: Array<{ call_id: string; name: string; arguments: string }> = [];

        if (response && typeof response === 'object' && Symbol.asyncIterator in response) {
          for await (const event of response as unknown as AsyncIterable<{
            type: string;
            delta?: string;
            item?: { type: string; call_id?: string; name?: string; arguments?: string; id?: string };
            item_id?: string;
            output_index?: number;
          }>) {
            switch (event.type) {
              case 'response.output_text.delta':
                if (event.delta) {
                  this.tokenCount++;
                  yield event.delta;
                }
                break;

              case 'response.reasoning_text.delta':
                if (event.delta) {
                  currentReasoningText += event.delta;
                }
                break;

              case 'response.reasoning_summary_text.delta':
                if (event.delta) {
                  currentReasoningSummaryText += event.delta;
                }
                break;

              case 'response.reasoning_summary_part.added':
                break;

              case 'response.reasoning_summary_part.done':
                if (currentReasoningSummaryText.trim()) {
                  yield `[REASONING]${currentReasoningSummaryText.trim()}`;
                  currentReasoningSummaryText = '';
                }
                break;

              case 'response.reasoning_part.done':
                if (currentReasoningText.trim()) {
                  yield `[REASONING]${currentReasoningText.trim()}`;
                  currentReasoningText = '';
                }
                break;

              case 'response.output_item.done': {
                // Yield any leftover reasoning
                if (currentReasoningText.trim()) {
                  yield `[REASONING]${currentReasoningText.trim()}`;
                  currentReasoningText = '';
                }
                if (currentReasoningSummaryText.trim()) {
                  yield `[REASONING]${currentReasoningSummaryText.trim()}`;
                  currentReasoningSummaryText = '';
                }
                // Capture completed function_call output items
                const item = event.item;
                if (item && item.type === 'function_call' && item.call_id && item.name) {
                  pendingFunctionCallItems.push({
                    call_id: item.call_id,
                    name: item.name,
                    arguments: item.arguments ?? '',
                  });
                }
                break;
              }

              case 'response.function_call_arguments.delta':
                // Arguments stream incrementally — we rely on output_item.done for the complete call
                break;

              case 'response.function_call_arguments.done':
                // Also a way to capture args if output_item.done doesn't fire
                if (event.item_id && functionCallAccumulator[event.item_id]) {
                  functionCallAccumulator[event.item_id].arguments =
                    (event as unknown as { arguments: string }).arguments ?? '';
                }
                break;

              case 'response.output_item.added': {
                // Track function_call items as they start
                const addedItem = event.item;
                if (addedItem && addedItem.type === 'function_call' && addedItem.call_id) {
                  functionCallAccumulator[addedItem.id ?? addedItem.call_id] = {
                    call_id: addedItem.call_id,
                    name: addedItem.name ?? '',
                    arguments: '',
                    item_id: addedItem.id,
                  };
                }
                break;
              }

              case 'response.created':
              case 'response.in_progress':
              case 'response.content_part.added':
              case 'response.output_text.done':
              case 'response.content_part.done':
              case 'response.completed':
                break;

              default:
                console.debug('Unknown response event type:', event.type);
                break;
            }
          }
        } else {
          throw new Error('Expected a streaming response from OpenAI responses endpoint');
        }

        // Yield any remaining reasoning text
        if (currentReasoningText.trim()) {
          yield `[REASONING]${currentReasoningText.trim()}`;
        }
        if (currentReasoningSummaryText.trim()) {
          yield `[REASONING]${currentReasoningSummaryText.trim()}`;
        }

        // If no function calls, we're done
        if (pendingFunctionCallItems.length === 0) {
          break;
        }

        // Emit tool_calls stream event for the UI
        const resolvedToolCalls = pendingFunctionCallItems.map((tc) => ({
          id: tc.call_id,
          name: tc.name,
          arguments: tc.arguments,
        }));
        yield JSON.stringify({ type: 'tool_calls', data: resolvedToolCalls });

        // Add the assistant's function_call items to the input for next turn
        for (const tc of pendingFunctionCallItems) {
          input.push({
            type: 'function_call',
            call_id: tc.call_id,
            name: tc.name,
            arguments: tc.arguments,
          });
        }

        // Execute each tool call and add function_call_output items
        for (const tc of pendingFunctionCallItems) {
          const tool = tools?.find((t) => t.definition.function.name === tc.name);
          let resultJson: string;

          if (tool) {
            try {
              const result = await tool.execute(tc.arguments);
              resultJson = JSON.stringify(result);
            } catch (err) {
              resultJson = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
            }
          } else {
            resultJson = JSON.stringify({ error: `Unknown tool: ${tc.name}` });
          }

          // Emit tool_result for UI
          yield JSON.stringify({
            type: 'tool_result',
            data: { toolCallId: tc.call_id, name: tc.name, result: resultJson },
          });

          // Add result to input for next iteration
          input.push({
            type: 'function_call_output',
            call_id: tc.call_id,
            output: resultJson,
          });
        }

        // Reset for next iteration
        pendingFunctionCallItems = [];
        // Continue the loop
      }
    }.bind(this)();

    return toReadableStream(gen);
  }
}
