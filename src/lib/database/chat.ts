import type { Chat } from '$lib/types';
import { deleteAttachmentsForMessage, saveAttachments } from './attachments';
import { deleteMessage, getMessagesForThread, saveMessage } from './messages';
import { deleteThread, getThread, saveThread } from './threads';
import type { StoredAttachment, StoredMessage, Thread } from './types';

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
        attachments,
        reasoning,
        provider,
        providerInstanceId,
        model,
        usage,
        metrics,
        error,
        createdAt,
        updatedAt,
      }) => ({
        id,
        role,
        content,
        attachments,
        reasoning,
        provider,
        providerInstanceId,
        model,
        usage,
        metrics,
        error,
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

      // Save messages and their attachments
      const savePromises = chat.messages.map(async (message) => {
        // Save the message first
        const storedMessage: StoredMessage = {
          ...message,
          threadId: chat.id,
        };
        await saveMessage(storedMessage);

        // Save attachments separately if they exist
        if (message.attachments && message.attachments.length > 0) {
          const storedAttachments: StoredAttachment[] = message.attachments.map((attachment) => ({
            id: attachment.id,
            type: attachment.type,
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.mimeType,
            data: attachment.data,
            messageId: message.id,
            threadId: chat.id,
            createdAt: new Date(),
          }));

          await saveAttachments(storedAttachments);
        }
      });

      await Promise.all(savePromises);

      // Clean up deleted messages and their attachments
      const currentIds = new Set(chat.messages.map((msg) => msg.id));
      const messagesToDelete = existingMessages.filter((msg) => !currentIds.has(msg.id));

      if (messagesToDelete.length > 0) {
        await Promise.all(
          messagesToDelete.map(async (message) => {
            await deleteAttachmentsForMessage(message.id);
            await deleteMessage(message.id);
          }),
        );
      }
    }
  } catch (error) {
    console.error('Error saving chat to IndexedDB:', error);
  } finally {
    saveMutex[chat.id] = false;
  }
}
