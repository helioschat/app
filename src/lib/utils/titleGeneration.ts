import { browser } from '$app/environment';
import { saveChatAsThreadAndMessages } from '$lib/database/chat';
import { getDefaultTitleModel } from '$lib/providers/known';
import { getLanguageModel } from '$lib/providers/registry';
import { chats } from '$lib/stores/chat';
import { advancedSettings, providerInstances } from '$lib/stores/settings';
import type { Chat, ProviderInstance } from '$lib/types';
import { get } from 'svelte/store';

/**
 * Generates a chat title from the first user message using a small/fast model
 * @param userMessage The user's first message
 * @param preferredProviderInstanceId Optional preferred provider instance ID
 * @returns Generated title with optional emoji, or fallback title
 */
export async function generateChatTitle(userMessage: string, preferredProviderInstanceId?: string): Promise<string> {
  const settings = get(advancedSettings);

  // Check if title generation is enabled
  if (!settings.titleGenerationEnabled) {
    return generateFallbackTitle(userMessage);
  }

  const instances = get(providerInstances);
  if (instances.length === 0) {
    return generateFallbackTitle(userMessage);
  }

  try {
    // Determine which provider instance to use
    let providerInstance: ProviderInstance;
    if (preferredProviderInstanceId) {
      const preferred = instances.find((inst) => inst.id === preferredProviderInstanceId);
      if (preferred) {
        providerInstance = preferred;
      } else {
        providerInstance = instances[0];
      }
    } else {
      providerInstance = instances[0];
    }

    // Determine which model to use for title generation
    let titleModel: string;
    let titleProviderInstance: ProviderInstance = providerInstance;

    if (settings.titleGenerationModel && settings.titleGenerationModel.trim()) {
      // Parse the custom model setting (format: "providerInstanceId:modelId")
      const [customProviderId, customModelId] = settings.titleGenerationModel.split(':');
      if (customProviderId && customModelId) {
        const customProvider = instances.find((inst) => inst.id === customProviderId);
        if (customProvider) {
          titleProviderInstance = customProvider;
          titleModel = customModelId;
        } else {
          // Fallback if custom provider not found - use current provider's model
          const fallbackModel = providerInstance.config.model;
          if (!fallbackModel) {
            return generateFallbackTitle(userMessage);
          }
          titleModel = fallbackModel;
        }
      } else {
        const fallbackModel = providerInstance.config.model;
        if (!fallbackModel) {
          return generateFallbackTitle(userMessage);
        }
        titleModel = fallbackModel;
      }
    } else {
      // Use provider default
      const defaultModel = getDefaultTitleModel(titleProviderInstance.config.matchedProvider || '');
      if (defaultModel) {
        titleModel = defaultModel;
      } else {
        // No default available, try to use provider's current model
        const currentModel = titleProviderInstance.config.model;
        if (!currentModel) {
          return generateFallbackTitle(userMessage);
        }
        titleModel = currentModel;
      }
    }

    // Create title generation config
    const titleConfig = {
      ...titleProviderInstance.config,
      model: titleModel,
      providerInstanceId: titleProviderInstance.id,
    };

    const model = getLanguageModel(titleProviderInstance.providerType, titleConfig);

    const instruction = `You are an assistant that generates short chat titles based on the first message from a user. Generate a concise, descriptive title (2-6 words) that captures the main topic or intent. If appropriate, you can add a single emoji at the beginning (it NEEDS to be at the beginning). Keep it brief and clear. The title should be suitable for a chat application and help users quickly identify the conversation's purpose. There's no situation where a title is not needed, so always generate one. Never ever directly quote the user's message. If you cannot determine a suitable title, summarize the message in a few words. You should never ever include any other text or reasoning in the response, just the title itself. You shouldn't refer to the conversation as a "chat", "conversation" or "starting". Please make sure that the emoji is at the beginning of the title, and that it is relevant to the topic.

Generate a title for this message:

${userMessage}`;

    // Prepare messages for title generation
    // We need to also include a user message for models that don't support system messages
    const messages = [
      {
        id: 'system',
        role: 'system' as const,
        content: instruction,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user',
        role: 'user' as const,
        content: instruction,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Stream the response and collect it
    const stream = model.stream(messages);
    const reader = stream.getReader();
    let generatedContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Skip reasoning content
        if (value.startsWith('[REASONING]')) {
          continue;
        }

        generatedContent += value;
      }
    } finally {
      reader.releaseLock();
    }

    // Clean up the generated title
    let title = generatedContent.trim();

    // Remove any wrapping quotes
    title = title.replace(/^["']|["']$/g, '');

    // Remove any thinking tags that might have leaked through
    title = title.replace(/<think>.*?<\/think>/gs, '').trim();

    // Limit length
    if (title.length > 50) {
      title = title.substring(0, 50).trim();
      // Try to cut at word boundary
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 20) {
        title = title.substring(0, lastSpace) + '...';
      } else {
        title = title + '...';
      }
    }

    // If title is empty or too short, use fallback
    if (!title || title.length < 3) {
      return generateFallbackTitle(userMessage);
    }

    return title;
  } catch (error) {
    console.error('Error generating chat title:', error);
    return generateFallbackTitle(userMessage);
  }
}

/**
 * Generates a fallback title from the user message
 * @param userMessage The user's message
 * @returns A fallback title
 */
function generateFallbackTitle(userMessage: string): string {
  if (!userMessage || userMessage.trim().length === 0) {
    return 'New Chat';
  }

  const trimmed = userMessage.trim();

  // If message is short enough, use it directly
  if (trimmed.length <= 30) {
    return trimmed;
  }

  // Try to cut at sentence or word boundary
  const title = trimmed.substring(0, 30);
  const lastSentence = title.lastIndexOf('.');
  const lastQuestion = title.lastIndexOf('?');
  const lastExclamation = title.lastIndexOf('!');
  const lastPunctuation = Math.max(lastSentence, lastQuestion, lastExclamation);

  if (lastPunctuation > 10) {
    return title.substring(0, lastPunctuation + 1);
  }

  const lastSpace = title.lastIndexOf(' ');
  if (lastSpace > 10) {
    return title.substring(0, lastSpace) + '...';
  }

  return title + '...';
}

/**
 * Updates the title of an existing chat by regenerating it
 * @param chatId The ID of the chat to update
 * @param providerInstanceId Optional provider instance ID to use for generation
 * @returns Promise that resolves to the generated title or undefined if failed
 */
export async function regenerateChatTitle(chatId: string, providerInstanceId?: string): Promise<string | undefined> {
  try {
    const settings = get(advancedSettings);
    if (!settings.titleGenerationEnabled) {
      return undefined;
    }

    // Get the chat
    const allChats = get(chats) as Chat[];
    const chat = allChats.find((c) => c.id === chatId);
    if (!chat || chat.messages.length === 0) {
      return undefined;
    }

    // Get the first user message
    const firstUserMessage = chat.messages.find((m) => m.role === 'user');
    if (!firstUserMessage || !firstUserMessage.content.trim()) {
      return undefined;
    }

    const generatedTitle = await generateChatTitle(
      firstUserMessage.content,
      providerInstanceId || chat.providerInstanceId,
    );

    // Update the chat title
    chats.update((allChats: Chat[]) => {
      const chatIndex = allChats.findIndex((c) => c.id === chatId);
      if (chatIndex === -1) return allChats;

      const updatedChat = {
        ...allChats[chatIndex],
        title: generatedTitle,
        updatedAt: new Date(),
      };

      allChats[chatIndex] = updatedChat;

      // Save to IndexedDB if not temporary
      if (browser && !updatedChat.temporary) {
        saveChatAsThreadAndMessages(updatedChat);
      }

      return [...allChats];
    });

    return generatedTitle;
  } catch (error) {
    console.error('Failed to regenerate chat title:', error);
    return undefined;
  }
}
