import type { ModelInfo } from '$lib/providers/base';
import { getLanguageModel } from '$lib/providers/registry';
import { chats } from '$lib/stores/chat';
import { availableModels } from '$lib/stores/modelCache';
import { advancedSettings, providerInstances } from '$lib/stores/settings';
import { syncThread } from '$lib/sync';
import type { Attachment, Chat, MessageWithAttachments, ProviderInstance } from '$lib/types';
import { get } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';
import { MessageProcessor } from './messageProcessor';
import { endStream, startStream } from './state';
import { StreamProcessor } from './streamProcessor';
import type { StreamContextMessage, StreamControllerState, StreamMetrics } from './types';

export class StreamingController {
  private isLoading: boolean = false;
  private currentlyStreamingMessageId: string = '';
  private chatId: string;
  private streamMetrics: StreamMetrics = { startTime: 0 };
  private currentReader: ReadableStreamDefaultReader<string> | null = null;

  constructor(chatId: string) {
    this.chatId = chatId;
  }

  private getProviderInstance(providerInstanceId: string): ProviderInstance {
    const instances = get(providerInstances) as ProviderInstance[];
    const instance = instances.find((inst: ProviderInstance) => inst.id === providerInstanceId);
    if (!instance) {
      throw new Error(`Provider instance not found: ${providerInstanceId}`);
    }
    return instance;
  }

  private buildModel(providerInstanceId: string, modelId: string, webSearchEnabled?: boolean) {
    const providerInstance = this.getProviderInstance(providerInstanceId);

    // Check if we should use a redirect model for web search
    let effectiveModelId = modelId;
    if (webSearchEnabled) {
      const redirectModel = this.getWebSearchRedirectModel(providerInstanceId, modelId);
      if (redirectModel) {
        effectiveModelId = redirectModel;
      }
    }

    const effectiveConfig = { ...providerInstance.config, model: effectiveModelId, providerInstanceId };
    return getLanguageModel(providerInstance.providerType, effectiveConfig);
  }

  private updateAssistantMessage(messageId: string, updater: (msg: MessageWithAttachments) => MessageWithAttachments) {
    chats.update((allChats) =>
      allChats.map((chat) => {
        if (chat.id !== this.chatId) return chat;
        const newMsgs = chat.messages.map((m) => (m.id === messageId ? updater(m) : m));
        return { ...chat, messages: newMsgs };
      }),
    );
  }

  private finalizeAssistantMessage(
    assistantMessageId: string,
    accumulatedContent: string,
    accumulatedReasoning: string,
    model: ReturnType<typeof getLanguageModel>,
  ) {
    endStream(this.chatId);
    this.isLoading = false;
    this.currentlyStreamingMessageId = '';

    const completionTokens = model.getCompletionTokenCount();
    const finalMetrics = MessageProcessor.calculateStreamMetrics(
      this.streamMetrics.startTime,
      completionTokens,
      this.streamMetrics.promptTokens,
      this.streamMetrics.thinkingTime,
    );

    let updatedChat: Chat | null = null;
    chats.update((allChats) =>
      allChats.map((chat) => {
        if (chat.id !== this.chatId) return chat;
        const updatedMessages = chat.messages.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: accumulatedContent,
                reasoning: accumulatedReasoning,
                updatedAt: new Date(),
                usage: {
                  promptTokens: finalMetrics.promptTokens,
                  completionTokens: finalMetrics.completionTokens,
                  totalTokens: finalMetrics.totalTokens,
                },
                metrics: finalMetrics,
              }
            : m,
        );
        updatedChat = { ...chat, messages: updatedMessages, updatedAt: new Date() };
        return updatedChat;
      }),
    );

    // Sync the thread after the message is finalized
    if (updatedChat) {
      syncThread(updatedChat);
    }
  }

  async cancelStream(): Promise<void> {
    if (this.currentReader) {
      try {
        await this.currentReader.cancel();
        this.currentReader = null;
        endStream(this.chatId);
        this.isLoading = false;
        this.currentlyStreamingMessageId = '';
      } catch (error) {
        console.error('Error canceling stream:', error);
      }
    }
  }

  async handleSubmit(
    userInput: string,
    activeChat: Chat,
    providerInstanceId: string,
    modelId: string,
    attachments?: Attachment[],
    webSearchEnabled?: boolean,
    webSearchContextSize?: 'low' | 'medium' | 'high',
  ): Promise<StreamControllerState> {
    if ((!userInput.trim() && (!attachments || attachments.length === 0)) || !activeChat || this.isLoading) {
      return this.getState();
    }

    const isExistingUserMessage =
      activeChat.messages.length === 1 &&
      activeChat.messages[0].role === 'user' &&
      activeChat.messages[0].content === userInput;

    let updatedMessages: MessageWithAttachments[];
    let assistantMessage: MessageWithAttachments;

    const model = this.buildModel(providerInstanceId, modelId, webSearchEnabled);
    const systemPrompt = get(advancedSettings).systemPrompt;

    // Get the effective model ID (with redirect if web search is enabled)
    let effectiveModelId = modelId;
    if (webSearchEnabled) {
      const redirectModel = this.getWebSearchRedirectModel(providerInstanceId, modelId);
      if (redirectModel) {
        effectiveModelId = redirectModel;
      }
    }

    const messagesForProvider = [];
    if (systemPrompt) {
      messagesForProvider.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    if (isExistingUserMessage) {
      assistantMessage = {
        id: uuidv7(),
        role: 'assistant',
        content: '',
        providerInstanceId: providerInstanceId,
        model: effectiveModelId,
        webSearchEnabled: webSearchEnabled,
        webSearchContextSize: webSearchContextSize,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      updatedMessages = [...activeChat.messages, assistantMessage];

      // Make sure to include attachments in the existing user message for the provider
      const messagesWithAttachments = activeChat.messages.map((msg) => {
        if (msg.role === 'user' && msg.content === userInput && attachments && attachments.length > 0) {
          return { ...msg, attachments };
        }
        return msg;
      });
      messagesForProvider.push(...messagesWithAttachments);
    } else {
      const userMessage: MessageWithAttachments = {
        id: uuidv7(),
        role: 'user',
        content: userInput,
        attachments: attachments,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      assistantMessage = {
        id: uuidv7(),
        role: 'assistant',
        content: '',
        providerInstanceId: providerInstanceId,
        model: effectiveModelId,
        webSearchEnabled: webSearchEnabled,
        webSearchContextSize: webSearchContextSize,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      updatedMessages = [...activeChat.messages, userMessage, assistantMessage];
      messagesForProvider.push(...activeChat.messages, userMessage);
    }

    const updatedChat = {
      ...activeChat,
      providerInstanceId: activeChat.providerInstanceId || providerInstanceId,
      model: effectiveModelId,
      messages: updatedMessages,
      updatedAt: new Date(),
    };

    chats.update((allChats) => allChats.map((chat) => (chat.id === this.chatId ? updatedChat : chat)));

    // Sync the thread after adding user/assistant messages
    syncThread(updatedChat);

    this.isLoading = true;
    this.currentlyStreamingMessageId = assistantMessage.id;

    const contextMessages: StreamContextMessage[] = updatedMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      providerInstanceId: m.providerInstanceId,
      model: m.model,
      usage: m.usage,
      metrics: m.metrics,
      reasoning: m.reasoning,
      attachmentIds: m.attachments?.map((att) => att.id),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    try {
      this.streamMetrics = {
        startTime: Date.now(),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      try {
        this.streamMetrics.promptTokens = await MessageProcessor.estimatePromptTokens(updatedMessages, model);
        this.streamMetrics.totalTokens = this.streamMetrics.promptTokens;
      } catch (e) {
        console.error('Error estimating tokens:', e);
      }

      // Check if web search should be enabled for this model
      const webSearchOptions =
        webSearchEnabled && this.supportsWebSearch(providerInstanceId, effectiveModelId)
          ? { enabled: true, searchContextSize: webSearchContextSize || 'low' }
          : undefined;

      const stream = model.stream(messagesForProvider as MessageWithAttachments[], webSearchOptions);
      this.currentReader = stream.getReader();

      startStream(this.chatId, assistantMessage.id, contextMessages);

      const streamProcessor = new StreamProcessor(
        this.chatId,
        assistantMessage.id,
        this.updateAssistantMessage.bind(this),
      );

      const { accumulatedContent, accumulatedReasoning, thinkingTime } = await streamProcessor.processStream(
        this.currentReader,
      );

      this.streamMetrics.thinkingTime = thinkingTime;
      this.finalizeAssistantMessage(assistantMessage.id, accumulatedContent, accumulatedReasoning, model);
    } catch (error) {
      await this.handleStreamError(error, assistantMessage.id, '');
    } finally {
      this.isLoading = false;
    }

    return this.getState();
  }

  /**
   * Regenerates response from the current conversation state without adding a new user message
   * Used for message editing where we want to generate from the existing (edited) conversation
   */
  async handleRegenerate(
    activeChat: Chat,
    providerInstanceId: string,
    modelId: string,
    webSearchEnabled?: boolean,
    webSearchContextSize?: 'low' | 'medium' | 'high',
  ): Promise<StreamControllerState> {
    if (!activeChat || this.isLoading || activeChat.messages.length === 0) {
      return this.getState();
    }

    const model = this.buildModel(providerInstanceId, modelId, webSearchEnabled);
    const systemPrompt = get(advancedSettings).systemPrompt;

    // Get the effective model ID (with redirect if web search is enabled)
    let effectiveModelId = modelId;
    if (webSearchEnabled) {
      const redirectModel = this.getWebSearchRedirectModel(providerInstanceId, modelId);
      if (redirectModel) {
        effectiveModelId = redirectModel;
      }
    }

    // Create assistant message
    const assistantMessage: MessageWithAttachments = {
      id: uuidv7(),
      role: 'assistant',
      content: '',
      providerInstanceId: providerInstanceId,
      model: effectiveModelId,
      webSearchEnabled: webSearchEnabled,
      webSearchContextSize: webSearchContextSize,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedMessages = [...activeChat.messages, assistantMessage];

    // Prepare messages for provider
    const messagesForProvider = [];
    if (systemPrompt) {
      messagesForProvider.push({
        role: 'system',
        content: systemPrompt,
      });
    }
    messagesForProvider.push(...activeChat.messages);

    const updatedChat = {
      ...activeChat,
      providerInstanceId: activeChat.providerInstanceId || providerInstanceId,
      model: effectiveModelId,
      messages: updatedMessages,
      updatedAt: new Date(),
    };

    chats.update((allChats) => allChats.map((chat) => (chat.id === this.chatId ? updatedChat : chat)));

    // Sync the thread after adding assistant message for regeneration
    syncThread(updatedChat);

    this.isLoading = true;
    this.currentlyStreamingMessageId = assistantMessage.id;

    const contextMessages: StreamContextMessage[] = updatedMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      providerInstanceId: m.providerInstanceId,
      model: m.model,
      usage: m.usage,
      metrics: m.metrics,
      reasoning: m.reasoning,
      attachmentIds: m.attachments?.map((att) => att.id),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    startStream(this.chatId, assistantMessage.id, contextMessages);

    try {
      this.streamMetrics = {
        startTime: Date.now(),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      try {
        this.streamMetrics.promptTokens = await MessageProcessor.estimatePromptTokens(updatedMessages, model);
        this.streamMetrics.totalTokens = this.streamMetrics.promptTokens;
      } catch (e) {
        console.error('Error estimating tokens:', e);
      }

      // Check if web search should be enabled for this model
      const webSearchOptions =
        webSearchEnabled && this.supportsWebSearch(providerInstanceId, effectiveModelId)
          ? { enabled: true, searchContextSize: webSearchContextSize || 'low' }
          : undefined;

      const stream = model.stream(messagesForProvider as MessageWithAttachments[], webSearchOptions);
      this.currentReader = stream.getReader();

      const streamProcessor = new StreamProcessor(
        this.chatId,
        assistantMessage.id,
        this.updateAssistantMessage.bind(this),
      );

      const { accumulatedContent, accumulatedReasoning, thinkingTime } = await streamProcessor.processStream(
        this.currentReader,
      );

      this.streamMetrics.thinkingTime = thinkingTime;
      this.finalizeAssistantMessage(assistantMessage.id, accumulatedContent, accumulatedReasoning, model);
    } catch (error) {
      await this.handleStreamError(error, assistantMessage.id, '');
    } finally {
      this.isLoading = false;
    }

    return this.getState();
  }

  private async handleStreamError(error: unknown, assistantMessageId: string, fallbackContent: string) {
    console.error('Stream error:', error);
    this.currentReader = null;

    // Extract error details based on the error type
    let errorDetails: { message: string; type: string; param?: string | null; code?: string; provider?: string };

    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = error as { error: Record<string, string | null> };
      if (apiError.error && typeof apiError.error === 'object') {
        errorDetails = {
          message: String(apiError.error.message || 'An unknown error occurred'),
          type: String(apiError.error.type || 'unknown_error'),
          param: apiError.error.param || null,
          code: apiError.error.code ? String(apiError.error.code) : undefined,
          provider: 'openai-compatible',
        };
      } else {
        errorDetails = {
          message: error instanceof Error ? error.message : 'An unknown error occurred',
          type: 'unknown_error',
          provider: 'openai-compatible',
        };
      }
    } else {
      errorDetails = {
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        type: 'unknown_error',
        provider: 'openai-compatible',
      };
    }

    let updatedChat: Chat | null = null;
    chats.update((allChats) => {
      return allChats.map((chat) => {
        if (chat.id !== this.chatId) return chat;

        const currentMessage = chat.messages.find((msg) => msg.id === assistantMessageId);
        const hasPartialContent = currentMessage && currentMessage.content.length > 0;

        const updatedChatMessages = chat.messages.map((msg) => {
          if (msg.id === assistantMessageId) {
            const finalMetrics = MessageProcessor.calculateStreamMetrics(
              this.streamMetrics.startTime,
              this.streamMetrics.completionTokens || 0,
              this.streamMetrics.promptTokens,
              this.streamMetrics.thinkingTime,
            );

            return {
              ...msg,
              content: hasPartialContent ? currentMessage!.content : fallbackContent,
              error: errorDetails,
              updatedAt: new Date(),
              usage: {
                promptTokens: this.streamMetrics.promptTokens,
                completionTokens: this.streamMetrics.completionTokens,
                totalTokens: this.streamMetrics.totalTokens,
              },
              metrics: finalMetrics,
            };
          }
          return msg;
        });

        endStream(this.chatId);
        this.currentlyStreamingMessageId = '';

        updatedChat = {
          ...chat,
          messages: updatedChatMessages,
          updatedAt: new Date(),
        };
        return updatedChat;
      });
    });

    // Sync the thread after the error is handled
    if (updatedChat) {
      syncThread(updatedChat);
    }
  }

  private getWebSearchRedirectModel(providerInstanceId: string, modelId: string): string | undefined {
    const cachedModels = get(availableModels);
    const models = cachedModels[providerInstanceId];
    if (models) {
      const model = models.find((m: ModelInfo) => m.id === modelId);
      return model?.webSearchModelRedirect;
    }
    return undefined;
  }

  private supportsWebSearch(providerInstanceId: string, modelId: string): boolean {
    const instances = get(providerInstances) as ProviderInstance[];
    const instance = instances.find((inst: ProviderInstance) => inst.id === providerInstanceId);
    if (!instance) return false;

    const cachedModels = get(availableModels);
    const models = cachedModels[instance.id];
    if (models) {
      const model = models.find((m: ModelInfo) => m.id === modelId);
      // Model supports web search if it explicitly supports it OR has a redirect model for web search
      return model?.supportsWebSearch || !!model?.webSearchModelRedirect;
    }

    return false;
  }

  getState(): StreamControllerState {
    return {
      isLoading: this.isLoading,
      currentlyStreamingMessageId: this.currentlyStreamingMessageId,
    };
  }
}
