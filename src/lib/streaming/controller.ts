import { getLanguageModel } from '$lib/providers/registry';
import { chats } from '$lib/stores/chat';
import { advancedSettings, providerInstances } from '$lib/stores/settings';
import type { Chat, Message, ProviderInstance } from '$lib/types';
import { get } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';
import { clearChatError } from '../stores/error';
import { MessageProcessor } from './messageProcessor';
import { endStream, startStream } from './state';
import { StreamProcessor } from './streamProcessor';
import type { StreamContextMessage, StreamControllerState, StreamMetrics } from './types';

export class StreamingController {
  private isLoading: boolean = false;
  private showResumeButton: boolean = false;
  private currentlyStreamingMessageId: string = '';
  private chatId: string;
  private providerInstanceId: string;
  private streamMetrics: StreamMetrics = { startTime: 0 };
  private currentReader: ReadableStreamDefaultReader<string> | null = null;

  constructor(chatId: string, providerInstanceId: string) {
    this.chatId = chatId;
    this.providerInstanceId = providerInstanceId;
  }

  private getProviderInstance(): ProviderInstance {
    const instances = get(providerInstances) as ProviderInstance[];
    const instance = instances.find((inst: ProviderInstance) => inst.id === this.providerInstanceId);
    if (!instance) {
      throw new Error(`Provider instance not found: ${this.providerInstanceId}`);
    }
    return instance;
  }

  private buildModel(modelId: string) {
    const providerInstance = this.getProviderInstance();
    const effectiveConfig = { ...providerInstance.config, model: modelId };
    return getLanguageModel(providerInstance.providerType, effectiveConfig);
  }

  private updateAssistantMessage(messageId: string, updater: (msg: Message) => Message) {
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
        return { ...chat, messages: updatedMessages, updatedAt: new Date() };
      }),
    );
  }

  async cancelStream(): Promise<void> {
    if (this.currentReader) {
      try {
        await this.currentReader.cancel();
        this.currentReader = null;
        endStream(this.chatId);
        this.isLoading = false;
        this.currentlyStreamingMessageId = '';
        this.showResumeButton = false;
      } catch (error) {
        console.error('Error canceling stream:', error);
      }
    }
  }

  async handleSubmit(userInput: string, activeChat: Chat, modelId: string): Promise<StreamControllerState> {
    if (!userInput.trim() || !activeChat || this.isLoading) {
      return this.getState();
    }

    clearChatError();

    const isExistingUserMessage =
      activeChat.messages.length === 1 &&
      activeChat.messages[0].role === 'user' &&
      activeChat.messages[0].content === userInput;

    let updatedMessages;
    let assistantMessage: Message;

    const model = this.buildModel(modelId);
    const systemPrompt = get(advancedSettings).systemPrompt;

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
        providerInstanceId: this.providerInstanceId,
        model: modelId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      updatedMessages = [...activeChat.messages, assistantMessage];
      messagesForProvider.push(...activeChat.messages);
    } else {
      const userMessage: Message = {
        id: uuidv7(),
        role: 'user',
        content: userInput,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      assistantMessage = {
        id: uuidv7(),
        role: 'assistant',
        content: '',
        providerInstanceId: this.providerInstanceId,
        model: modelId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      updatedMessages = [...activeChat.messages, userMessage, assistantMessage];
      messagesForProvider.push(...activeChat.messages, userMessage);
    }

    const updatedChat = {
      ...activeChat,
      providerInstanceId: activeChat.providerInstanceId || this.providerInstanceId,
      model: modelId,
      messages: updatedMessages,
      updatedAt: new Date(),
    };

    chats.update((allChats) => allChats.map((chat) => (chat.id === this.chatId ? updatedChat : chat)));

    this.isLoading = true;
    this.currentlyStreamingMessageId = assistantMessage.id;
    this.showResumeButton = false;

    const contextMessages: StreamContextMessage[] = updatedMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      providerInstanceId: m.providerInstanceId,
      model: m.model,
      usage: m.usage,
      metrics: m.metrics,
      reasoning: m.reasoning,
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

      const stream = model.stream(messagesForProvider as Message[]);
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

  async resumeStream(
    contextMessages: StreamContextMessage[],
    assistantMessageId: string,
    activeChat: Chat,
    modelId: string,
  ): Promise<StreamControllerState> {
    if (this.isLoading || !contextMessages?.length) {
      return this.getState();
    }

    this.isLoading = true;
    this.currentlyStreamingMessageId = assistantMessageId;

    try {
      clearChatError();

      const model = this.buildModel(modelId);
      const messageIndex = activeChat?.messages.findIndex((m) => m.id === assistantMessageId) ?? -1;

      if (messageIndex < 0) {
        throw new Error('Message not found for resuming');
      }

      const currentMessage = activeChat.messages[messageIndex];
      const accumulatedContent = currentMessage.content || '';

      this.streamMetrics = {
        startTime: Date.now(),
        promptTokens: currentMessage.usage?.promptTokens || 0,
        completionTokens: currentMessage.usage?.completionTokens || 0,
        totalTokens: currentMessage.usage?.totalTokens || 0,
      };

      const systemPrompt = get(advancedSettings).systemPrompt;
      const messagesForProvider = [];

      if (systemPrompt) {
        messagesForProvider.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      // Create a continuation prompt
      const continuationMessage: Message = {
        id: uuidv7(),
        role: 'user' as const,
        content: `You previously wrote the following text. Continue writing exactly where you left off, maintaining the same style, tone, and flow. Make sure there's proper spacing between the last word of the existing text and the first word of your continuation. Do not repeat any content, do not start a new section, do not introduce the topic again, and do not acknowledge this instruction in your response. Just continue writing as if you never stopped:\n\n${accumulatedContent}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      messagesForProvider.push(continuationMessage);

      try {
        const newPromptTokens = await MessageProcessor.estimatePromptTokens([continuationMessage], model);
        this.streamMetrics.promptTokens = (this.streamMetrics.promptTokens || 0) + newPromptTokens;
        this.streamMetrics.totalTokens = (this.streamMetrics.totalTokens || 0) + newPromptTokens;
      } catch (e) {
        console.error('Error estimating tokens:', e);
      }

      const stream = model.stream(messagesForProvider as Message[]);
      const reader = stream.getReader();

      startStream(this.chatId, assistantMessageId, contextMessages);

      const streamProcessor = new StreamProcessor(
        this.chatId,
        assistantMessageId,
        this.updateAssistantMessage.bind(this),
      );

      const {
        accumulatedContent: finalContent,
        accumulatedReasoning,
        thinkingTime,
      } = await streamProcessor.processStream(reader, accumulatedContent);

      this.streamMetrics.thinkingTime = thinkingTime;
      this.finalizeAssistantMessage(assistantMessageId, finalContent, accumulatedReasoning, model);
    } catch (error) {
      await this.handleStreamError(
        error,
        assistantMessageId,
        activeChat.messages.find((m) => m.id === assistantMessageId)?.content || '',
      );
    } finally {
      this.isLoading = false;
    }

    return this.getState();
  }

  private async handleStreamError(error: unknown, assistantMessageId: string, fallbackContent: string) {
    console.error('Stream error:', error);
    this.currentReader = null;

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

        if (hasPartialContent) {
          this.showResumeButton = true;
        } else {
          endStream(this.chatId);
          this.currentlyStreamingMessageId = '';
        }

        return {
          ...chat,
          messages: updatedChatMessages,
          updatedAt: new Date(),
        };
      });
    });
  }

  getState(): StreamControllerState {
    return {
      isLoading: this.isLoading,
      showResumeButton: this.showResumeButton,
      currentlyStreamingMessageId: this.currentlyStreamingMessageId,
    };
  }

  updateProviderInstance(providerInstanceId: string): void {
    this.providerInstanceId = providerInstanceId;
  }
}
