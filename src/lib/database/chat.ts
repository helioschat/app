import type { Chat } from '$lib/types';
import { deleteMessage, getMessagesForThread, saveMessage } from './messages';
import { deleteThread, getThread, saveThread } from './threads';
import type { StoredMessage, Thread } from './types';

// Simple mutex to prevent concurrent saves of the same chat
const saveMutex: Record<string, boolean> = {};

export async function getChatFromThread(threadId: string): Promise<Chat | null> {
  const thread = await getThread(threadId);
  if (!thread) return null;

  const messages = await getMessagesForThread(threadId);
  if (messages.length === 0) {
    await deleteThread(threadId);
    return null;
  }

  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: messages.map(
      ({
        id,
        role,
        content,
        reasoning,
        provider,
        providerInstanceId,
        model,
        usage,
        metrics,
        createdAt,
        updatedAt,
      }) => ({
        id,
        role,
        content,
        reasoning,
        provider,
        providerInstanceId,
        model,
        usage,
        metrics,
        createdAt,
        updatedAt,
      }),
    ),
    providerInstanceId: thread.providerInstanceId,
    model: thread.model,
    pinned: thread.pinned,
  };
}

export async function saveChatAsThreadAndMessages(chat: Chat): Promise<void> {
  if (saveMutex[chat.id]) {
    console.debug('Already saving chat, skipping duplicate save:', chat.id);
    return;
  }

  saveMutex[chat.id] = true;

  try {
    const thread: Thread = {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessageDate: chat.messages.length > 0 ? chat.updatedAt : chat.createdAt,
      messageCount: chat.messages.length,
      providerInstanceId: chat.providerInstanceId,
      model: chat.model,
      pinned: chat.pinned,
    };

    await saveThread(thread);

    if (chat.messages.length > 0) {
      const existingMessages = await getMessagesForThread(chat.id);

      const savePromises = chat.messages.map((message) => {
        const storedMessage: StoredMessage = {
          ...message,
          threadId: chat.id,
        };

        return saveMessage(storedMessage);
      });

      await Promise.all(savePromises);

      // Clean up deleted messages
      const currentIds = new Set(chat.messages.map((msg) => msg.id));
      const messagesToDelete = existingMessages.filter((msg) => !currentIds.has(msg.id));

      if (messagesToDelete.length > 0) {
        await Promise.all(messagesToDelete.map((message) => deleteMessage(message.id)));
      }
    }
  } catch (error) {
    console.error('Error saving chat to IndexedDB:', error);
  } finally {
    saveMutex[chat.id] = false;
  }
}
