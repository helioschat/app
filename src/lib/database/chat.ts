import type { Chat, MessageWithAttachments } from '$lib/types';
import { deleteAttachmentsForMessage, getAttachmentsForMessage, saveAttachments } from './attachments';
import { createPreviewUrl, deleteMessage, getMessagesForThread, saveMessage } from './messages';
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

  // Load attachments for all messages that have attachment IDs
  const messagesWithAttachments: MessageWithAttachments[] = await Promise.all(
    messages.map(async (message) => {
      if (message.attachmentIds && message.attachmentIds.length > 0) {
        const attachments = await getAttachmentsForMessage(message.id);
        const processedAttachments = attachments.map((att) => ({
          id: att.id,
          type: att.type as 'image' | 'file',
          name: att.name,
          size: att.size,
          mimeType: att.mimeType,
          data: att.data,
          previewUrl: att.type === 'image' ? createPreviewUrl(att.data, att.mimeType) : undefined,
        }));

        return {
          ...message,
          attachments: processedAttachments,
        };
      }

      return message;
    }),
  );

  return {
    ...thread,
    messages: messagesWithAttachments,
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
        // Extract attachment IDs and save message with only IDs
        const attachmentIds = message.attachments?.map((att) => att.id);
        const messageToStore: StoredMessage = {
          id: message.id,
          role: message.role,
          content: message.content,
          attachmentIds,
          reasoning: message.reasoning,
          providerInstanceId: message.providerInstanceId,
          model: message.model,
          usage: message.usage,
          metrics: message.metrics,
          error: message.error,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          threadId: chat.id,
        };
        await saveMessage(messageToStore);

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
