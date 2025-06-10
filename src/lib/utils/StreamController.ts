import type { StreamMetrics } from '$lib/providers/base';
import { getLanguageModel } from '$lib/providers/registry';
import { chats } from '$lib/stores/chat';
import { providerInstances } from '$lib/stores/settings';
import type { Chat, Message, ProviderInstance } from '$lib/types';
import { get } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';
import { clearChatError } from '../stores/error';
import type { StreamContextMessage } from './streamState';
import { endStream, startStream, updateStreamContent } from './streamState';

export class StreamController {
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

  /**
   * Cancel the current stream if one is active
   */
  async cancelStream(): Promise<void> {
    if (this.currentReader) {
      try {
        await this.currentReader.cancel();
        this.currentReader = null;
        endStream();
        this.isLoading = false;
        this.currentlyStreamingMessageId = '';
        this.showResumeButton = false;
      } catch (error) {
        console.error('Error canceling stream:', error);
      }
    }
  }

  /**
   * Process a user message and stream the assistant response
   */
  async handleSubmit(
    userInput: string,
    activeChat: Chat,
    modelId: string,
  ): Promise<{
    isLoading: boolean;
    showResumeButton: boolean;
    currentlyStreamingMessageId: string;
  }> {
    if (!userInput.trim() || !activeChat || this.isLoading) {
      return this.getState();
    }

    // Clear any previous errors when starting a new chat
    clearChatError();

    // Check if this is a chat with an existing user message (from landing page)
    // In this case, we don't need to create a new user message
    const isExistingUserMessage =
      activeChat.messages.length === 1 &&
      activeChat.messages[0].role === 'user' &&
      activeChat.messages[0].content === userInput;

    let updatedMessages;
    let assistantMessage: Message;

    // Get the provider instance for the current chat
    const providerInstance = this.getProviderInstance();
    const effectiveConfig = { ...providerInstance.config, model: modelId };

    // Create the model with the correct provider type from the instance
    const model = getLanguageModel(providerInstance.providerType, effectiveConfig);

    if (isExistingUserMessage) {
      // Just add an assistant message to respond to the existing user message
      assistantMessage = {
        id: uuidv7(),
        role: 'assistant',
        content: '',
        providerInstanceId: this.providerInstanceId,
        model: modelId,
      };
      updatedMessages = [...activeChat.messages, assistantMessage];
    } else {
      // Standard case: add both user and assistant messages
      const userMessage: Message = {
        id: uuidv7(),
        role: 'user',
        content: userInput,
      };

      assistantMessage = {
        id: uuidv7(),
        role: 'assistant',
        content: '',
        providerInstanceId: this.providerInstanceId,
        model: modelId,
      };

      updatedMessages = [...activeChat.messages, userMessage, assistantMessage];
    }

    // Update the chat with provider and model information if not already set
    const updatedChat = {
      ...activeChat,
      providerInstanceId: activeChat.providerInstanceId || this.providerInstanceId,
      model: modelId,
      messages: updatedMessages,
      updatedAt: new Date(),
    };

    // Update the chats store directly
    chats.update((allChats) => {
      return allChats.map((chat) => {
        if (chat.id === this.chatId) {
          return updatedChat;
        }
        return chat;
      });
    });

    this.isLoading = true;
    this.currentlyStreamingMessageId = assistantMessage.id;
    this.showResumeButton = false;

    // Store context messages for possible resume
    const contextMessages: StreamContextMessage[] = updatedMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      providerInstanceId: m.providerInstanceId,
      model: m.model,
      usage: m.usage,
      metrics: m.metrics,
    }));

    try {
      // Start metrics tracking
      this.streamMetrics = {
        startTime: Date.now(),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      // Try to count tokens if the provider supports it
      try {
        if (model.countTokens) {
          const tokenCount = await model.countTokens(updatedMessages);
          this.streamMetrics.promptTokens = tokenCount.promptTokens;
          this.streamMetrics.totalTokens = tokenCount.totalTokens;
        } else {
          // Fallback to rough estimate
          const totalWords = updatedMessages.reduce((acc, msg) => {
            return acc + msg.content.split(/\s+/).length;
          }, 0);
          const estimatedTokens = Math.ceil(totalWords * 1.3); // ~1.3 tokens per word
          this.streamMetrics.promptTokens = estimatedTokens;
          this.streamMetrics.totalTokens = estimatedTokens;
        }
      } catch (error) {
        console.error('Error estimating tokens:', error);
        // Continue without token counting
      }

      const stream = model.stream(updatedMessages);
      this.currentReader = stream.getReader();

      // Start the stream and record state with context
      startStream(this.chatId, assistantMessage.id, contextMessages);

      // Initialize accumulated content
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await this.currentReader.read();
        if (done) break;

        // Update the accumulated content
        accumulatedContent += value;

        // Save the partial content to stream state for recovery
        updateStreamContent(accumulatedContent);

        // Update the assistant message content
        chats.update((allChats) => {
          return allChats.map((chat) => {
            if (chat.id === this.chatId) {
              // Find the assistant message and update its content
              const updatedChatMessages = chat.messages.map((msg) => {
                if (msg.id === assistantMessage.id) {
                  return {
                    ...msg,
                    content: accumulatedContent,
                  };
                }
                return msg;
              });

              return {
                ...chat,
                messages: updatedChatMessages,
                updatedAt: new Date(),
              };
            }
            return chat;
          });
        });
      }

      // Stream completed successfully
      this.currentReader = null;
      endStream();
      this.showResumeButton = false;
      this.currentlyStreamingMessageId = '';

      // Complete metrics tracking
      this.streamMetrics.endTime = Date.now();
      this.streamMetrics.totalTime = this.streamMetrics.endTime - this.streamMetrics.startTime;

      // Get the actual completion token count from the model
      this.streamMetrics.completionTokens = model.getCompletionTokenCount();
      this.streamMetrics.totalTokens = (this.streamMetrics.promptTokens || 0) + this.streamMetrics.completionTokens;

      // Calculate tokens per second
      this.streamMetrics.tokensPerSecond = this.streamMetrics.completionTokens
        ? this.streamMetrics.completionTokens / (this.streamMetrics.totalTime / 1000)
        : undefined;

      // Update the message with final metrics
      chats.update((allChats) => {
        return allChats.map((chat) => {
          if (chat.id === this.chatId) {
            const updatedChatMessages = chat.messages.map((msg) => {
              if (msg.id === assistantMessage.id) {
                return {
                  ...msg,
                  usage: {
                    promptTokens: this.streamMetrics.promptTokens,
                    completionTokens: this.streamMetrics.completionTokens,
                    totalTokens: this.streamMetrics.totalTokens,
                  },
                  metrics: {
                    startTime: this.streamMetrics.startTime,
                    endTime: this.streamMetrics.endTime,
                    totalTime: this.streamMetrics.totalTime,
                    tokensPerSecond: this.streamMetrics.tokensPerSecond,
                  },
                };
              }
              return msg;
            });

            return {
              ...chat,
              messages: updatedChatMessages,
              updatedAt: new Date(),
            };
          }
          return chat;
        });
      });
    } catch (error) {
      console.error('Stream error:', error);
      this.currentReader = null;

      // Keep partial content if there is any and show resume button
      chats.update((allChats) => {
        return allChats.map((chat) => {
          if (chat.id === this.chatId) {
            const currentMessage = chat.messages.find((msg) => msg.id === assistantMessage.id);
            const hasPartialContent = currentMessage && currentMessage.content.length > 0;

            const updatedChatMessages = chat.messages.map((msg) => {
              if (msg.id === assistantMessage.id) {
                return {
                  ...msg,
                  content: hasPartialContent ? currentMessage!.content : '',
                  // Add partial metrics even in case of error
                  usage: {
                    promptTokens: this.streamMetrics.promptTokens,
                    completionTokens: this.streamMetrics.completionTokens,
                    totalTokens: this.streamMetrics.totalTokens,
                  },
                  metrics: {
                    startTime: this.streamMetrics.startTime,
                    endTime: Date.now(),
                    totalTime: Date.now() - this.streamMetrics.startTime,
                    tokensPerSecond: this.streamMetrics.completionTokens
                      ? this.streamMetrics.completionTokens / ((Date.now() - this.streamMetrics.startTime) / 1000)
                      : undefined,
                  },
                };
              }
              return msg;
            });

            // If we have partial content, show the resume button but don't end the stream state
            if (hasPartialContent) {
              this.showResumeButton = true;
            } else {
              // If no partial content, clean up stream state
              endStream();
              this.currentlyStreamingMessageId = '';
            }

            return {
              ...chat,
              messages: updatedChatMessages,
              updatedAt: new Date(),
            };
          }
          return chat;
        });
      });
    } finally {
      this.isLoading = false;
    }

    return this.getState();
  }

  /**
   * Resume a streaming message that was interrupted
   */
  async resumeStream(
    contextMessages: StreamContextMessage[],
    assistantMessageId: string,
    activeChat: Chat,
    modelId: string,
  ): Promise<{
    isLoading: boolean;
    showResumeButton: boolean;
    currentlyStreamingMessageId: string;
  }> {
    if (this.isLoading) {
      return this.getState();
    }

    this.isLoading = true;
    this.currentlyStreamingMessageId = assistantMessageId;

    try {
      // Clear any previous errors
      clearChatError();

      // Fallback to rough estimate if no context is provided
      if (!contextMessages || contextMessages.length === 0) {
        this.isLoading = false;
        return this.getState();
      }

      const providerInstance = this.getProviderInstance();
      const effectiveConfig = { ...providerInstance.config, model: modelId };

      // Create the model instance
      const model = getLanguageModel(providerInstance.providerType, effectiveConfig);

      // Find the message being resumed
      const messageIndex = activeChat?.messages.findIndex((m) => m.id === assistantMessageId) ?? -1;
      if (messageIndex < 0) {
        throw new Error('Message not found for resuming');
      }

      // Get the current content to continue from
      const currentContent = activeChat?.messages[messageIndex].content || '';

      // Start metrics tracking
      this.streamMetrics = {
        startTime: Date.now(),
        // If we have existing metrics, preserve them
        promptTokens: activeChat.messages[messageIndex].usage?.promptTokens || 0,
        completionTokens: activeChat.messages[messageIndex].usage?.completionTokens || 0,
        totalTokens: activeChat.messages[messageIndex].usage?.totalTokens || 0,
      };

      // Create a minimal context with just two messages for continuation
      const minimalContext: StreamContextMessage[] = [
        // First message is the user's instruction to continue
        {
          id: uuidv7(),
          role: 'user',
          content: `You previously wrote the following text. Continue writing exactly where you left off, maintaining the same style, tone, and flow. Make sure there's proper spacing between the last word of the existing text and the first word of your continuation. Do not repeat any content, do not start a new section, do not introduce the topic again, and do not acknowledge this instruction in your response. Just continue writing as if you never stopped:\n\n${currentContent}`,
        },
        // Second message is an empty assistant message that will be filled with the continuation
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          providerInstanceId: this.providerInstanceId,
          model: model.getModelName(),
        },
      ];

      // Try to count tokens if the provider supports it
      try {
        if (model.countTokens) {
          const tokenCount = await model.countTokens(minimalContext as Message[]);
          // Add to existing token count
          this.streamMetrics.promptTokens = (this.streamMetrics.promptTokens || 0) + tokenCount.promptTokens;
          this.streamMetrics.totalTokens = (this.streamMetrics.totalTokens || 0) + tokenCount.promptTokens;
        } else {
          // Fallback to rough estimate
          const totalWords = minimalContext.reduce((acc, msg) => {
            return acc + msg.content.split(/\s+/).length;
          }, 0);
          const estimatedTokens = Math.ceil(totalWords * 1.3); // ~1.3 tokens per word
          this.streamMetrics.promptTokens = estimatedTokens;
          this.streamMetrics.totalTokens = estimatedTokens;
        }
      } catch (error) {
        console.error('Error estimating tokens:', error);
        // Continue without token counting
      }

      // Stream using the minimal context approach
      const stream = model.stream(minimalContext as Message[]);
      const reader = stream.getReader();

      // Start the stream and record state with the original context messages
      // This ensures we have the full history for potential future resumptions
      startStream(this.chatId, assistantMessageId, contextMessages);

      // Initialize with current content
      let accumulatedContent = currentContent;
      let newContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new content
        newContent += value;
        accumulatedContent = currentContent + newContent;

        // Save the partial content to stream state for recovery
        updateStreamContent(accumulatedContent);

        // Update the message content in the store
        chats.update((allChats) => {
          return allChats.map((chat) => {
            if (chat.id === this.chatId) {
              const updatedMessages = chat.messages.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return {
                    ...msg,
                    content: accumulatedContent,
                    providerInstanceId: this.providerInstanceId,
                    model: model.getModelName(),
                  };
                }
                return msg;
              });

              return {
                ...chat,
                messages: updatedMessages,
                updatedAt: new Date(),
              };
            }
            return chat;
          });
        });
      }

      // Stream completed successfully
      endStream();
      this.showResumeButton = false;
      this.currentlyStreamingMessageId = '';

      // Complete metrics tracking
      this.streamMetrics.endTime = Date.now();
      this.streamMetrics.totalTime = this.streamMetrics.endTime - this.streamMetrics.startTime;

      // Get the actual completion token count from the model
      this.streamMetrics.completionTokens = model.getCompletionTokenCount();
      this.streamMetrics.totalTokens = (this.streamMetrics.promptTokens || 0) + this.streamMetrics.completionTokens;

      // Calculate tokens per second
      this.streamMetrics.tokensPerSecond = this.streamMetrics.completionTokens
        ? this.streamMetrics.completionTokens / (this.streamMetrics.totalTime / 1000)
        : undefined;

      // Update the message with final metrics
      chats.update((allChats) => {
        return allChats.map((chat) => {
          if (chat.id === this.chatId) {
            const updatedChatMessages = chat.messages.map((msg) => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  content: accumulatedContent,
                  providerInstanceId: this.providerInstanceId,
                  model: model.getModelName(),
                  usage: {
                    promptTokens: this.streamMetrics.promptTokens,
                    completionTokens: this.streamMetrics.completionTokens,
                    totalTokens: this.streamMetrics.totalTokens,
                  },
                  metrics: {
                    startTime: this.streamMetrics.startTime,
                    endTime: this.streamMetrics.endTime,
                    totalTime: this.streamMetrics.totalTime,
                    tokensPerSecond: this.streamMetrics.tokensPerSecond,
                  },
                };
              }
              return msg;
            });

            return {
              ...chat,
              messages: updatedChatMessages,
              updatedAt: new Date(),
            };
          }
          return chat;
        });
      });
    } catch (error) {
      console.error('Resume stream error:', error);

      // Handle error state
      chats.update((allChats) => {
        return allChats.map((chat) => {
          if (chat.id === this.chatId) {
            const currentMessage = chat.messages.find((msg) => msg.id === assistantMessageId);

            const updatedChatMessages = chat.messages.map((msg) => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  // Keep existing content
                  content: currentMessage?.content || 'Error resuming generation.',
                  // Add partial metrics even in case of error
                  usage: {
                    promptTokens: this.streamMetrics.promptTokens,
                    completionTokens: this.streamMetrics.completionTokens,
                    totalTokens: this.streamMetrics.totalTokens,
                  },
                  metrics: {
                    startTime: this.streamMetrics.startTime,
                    endTime: Date.now(),
                    totalTime: Date.now() - this.streamMetrics.startTime,
                    tokensPerSecond: undefined,
                  },
                };
              }
              return msg;
            });

            // Clean up stream state
            endStream();
            this.currentlyStreamingMessageId = '';

            return {
              ...chat,
              messages: updatedChatMessages,
              updatedAt: new Date(),
            };
          }
          return chat;
        });
      });
    } finally {
      this.isLoading = false;
    }

    return this.getState();
  }

  // Get the current state for the UI
  getState() {
    return {
      isLoading: this.isLoading,
      showResumeButton: this.showResumeButton,
      currentlyStreamingMessageId: this.currentlyStreamingMessageId,
    };
  }

  updateProviderInstance(providerInstanceId: string) {
    this.providerInstanceId = providerInstanceId;
  }
}
