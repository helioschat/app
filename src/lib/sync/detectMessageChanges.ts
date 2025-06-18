import type { Chat, MessageWithAttachments } from '$lib/types';

/**
 * Detect message changes between two chat states
 */
export function detectMessageChanges(
  previousChats: Chat[],
  currentChats: Chat[],
): Array<{
  type: 'added' | 'modified' | 'deleted';
  message: MessageWithAttachments & { threadId: string };
}> {
  const changes: Array<{
    type: 'added' | 'modified' | 'deleted';
    message: MessageWithAttachments & { threadId: string };
  }> = [];

  // Create maps for efficient lookups
  const previousMessagesMap = new Map<string, { message: MessageWithAttachments; threadId: string }>();
  const currentMessagesMap = new Map<string, { message: MessageWithAttachments; threadId: string }>();

  // Build previous messages map
  previousChats.forEach((chat) => {
    if (!chat.temporary) {
      chat.messages.forEach((message) => {
        previousMessagesMap.set(message.id, { message, threadId: chat.id });
      });
    }
  });

  // Build current messages map and detect added/modified messages
  currentChats.forEach((chat) => {
    if (!chat.temporary) {
      chat.messages.forEach((message) => {
        currentMessagesMap.set(message.id, { message, threadId: chat.id });

        const previousMessage = previousMessagesMap.get(message.id);
        if (!previousMessage) {
          changes.push({ type: 'added', message: { ...message, threadId: chat.id } });
        } else if (
          previousMessage.message.content !== message.content ||
          previousMessage.message.updatedAt.getTime() !== message.updatedAt.getTime() ||
          JSON.stringify(previousMessage.message.attachments) !== JSON.stringify(message.attachments)
        ) {
          changes.push({ type: 'modified', message: { ...message, threadId: chat.id } });
        }
      });
    }
  });

  // Detect deleted messages
  previousMessagesMap.forEach(({ message, threadId }, messageId) => {
    if (!currentMessagesMap.has(messageId)) {
      changes.push({ type: 'deleted', message: { ...message, threadId } });
    }
  });

  return changes;
}
