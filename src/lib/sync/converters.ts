import type { Thread } from '$lib/database/types';
import { syncManager } from '$lib/stores/sync';
import type { Chat, MessageWithAttachments } from '$lib/types';
import type { SyncMessage, SyncRequest, SyncThread } from '$lib/types/sync';
import { encryptValue } from './crypto';

/**
 * Convert Chat to Thread (without messages) for syncing
 */
export function chatToThread(chat: Chat): Thread {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    providerInstanceId: chat.providerInstanceId,
    model: chat.model,
    pinned: chat.pinned,
    branchedFrom: chat.branchedFrom,
    webSearchEnabled: chat.webSearchEnabled,
    webSearchContextSize: chat.webSearchContextSize,
    lastMessageDate:
      chat.messages.length > 0
        ? new Date(Math.max(...chat.messages.map((m) => m.updatedAt.getTime())))
        : chat.updatedAt,
    messageCount: chat.messages.length,
  };
}

/**
 * Convert Thread to SyncThread with encryption
 */
export async function threadToSyncThread(
  thread: Thread,
  userId: string,
  passphraseHash: string,
): Promise<SyncRequest<SyncThread>> {
  // Encrypt all sensitive fields
  const encryptedTitle = await encryptValue(thread.title, passphraseHash);
  const encryptedMessageCount = await encryptValue(thread.messageCount.toString(), passphraseHash);
  const encryptedLastMessageDate = await encryptValue(thread.lastMessageDate.toISOString(), passphraseHash);
  const encryptedPinned = await encryptValue((thread.pinned || false).toString(), passphraseHash);
  const encryptedProviderInstanceId = await encryptValue(thread.providerInstanceId || '', passphraseHash);
  const encryptedModel = await encryptValue(thread.model || '', passphraseHash);
  const encryptedWebSearchEnabled = await encryptValue((thread.webSearchEnabled || false).toString(), passphraseHash);
  const encryptedWebSearchContextSize = await encryptValue(
    (thread.webSearchContextSize || 'medium').toString(),
    passphraseHash,
  );
  const encryptedCreatedAt = await encryptValue(thread.createdAt.toISOString(), passphraseHash);
  const encryptedUpdatedAt = await encryptValue(thread.updatedAt.toISOString(), passphraseHash);

  // Handle optional branchedFrom field
  let encryptedBranchedFrom: string | undefined;
  if (thread.branchedFrom) {
    encryptedBranchedFrom = await encryptValue(JSON.stringify(thread.branchedFrom), passphraseHash);
  }

  return {
    machine_id: syncManager.getMachineId(),
    user_id: userId,
    data: {
      id: thread.id,
      title: encryptedTitle,
      messageCount: encryptedMessageCount,
      lastMessageDate: encryptedLastMessageDate,
      pinned: encryptedPinned,
      providerInstanceId: encryptedProviderInstanceId,
      model: encryptedModel,
      branchedFrom: encryptedBranchedFrom,
      webSearchEnabled: encryptedWebSearchEnabled,
      webSearchContextSize: encryptedWebSearchContextSize,
      created_at: encryptedCreatedAt,
      updated_at: encryptedUpdatedAt,
    },
    version: Date.now(),
  };
}

/**
 * Convert Message to SyncMessage with encryption
 */
export async function messageToSyncMessage(
  message: MessageWithAttachments & { threadId: string },
  userId: string,
  passphraseHash: string,
): Promise<SyncRequest<SyncMessage>> {
  const encryptedRole = await encryptValue(message.role, passphraseHash);
  const encryptedContent = await encryptValue(message.content, passphraseHash);
  const encryptedThreadId = await encryptValue(message.threadId, passphraseHash);
  const encryptedCreatedAt = await encryptValue(message.createdAt.toISOString(), passphraseHash);
  const encryptedUpdatedAt = await encryptValue(new Date().toISOString(), passphraseHash);

  const syncMessageData: SyncMessage = {
    id: message.id,
    user_id: userId,
    thread_id: message.threadId,
    threadId: encryptedThreadId,
    role: encryptedRole,
    content: encryptedContent,
    created_at: encryptedCreatedAt,
    updated_at: encryptedUpdatedAt,
    version: Date.now(),
  };

  if (message.reasoning) {
    syncMessageData.reasoning = await encryptValue(message.reasoning, passphraseHash);
  }
  if (message.providerInstanceId) {
    syncMessageData.providerInstanceId = await encryptValue(message.providerInstanceId, passphraseHash);
  }
  if (message.model) {
    syncMessageData.model = await encryptValue(message.model, passphraseHash);
  }
  if (message.usage) {
    syncMessageData.usage = await encryptValue(JSON.stringify(message.usage), passphraseHash);
  }
  if (message.metrics) {
    syncMessageData.metrics = await encryptValue(JSON.stringify(message.metrics), passphraseHash);
  }
  if (message.error) {
    syncMessageData.error = await encryptValue(JSON.stringify(message.error), passphraseHash);
  }
  if (message.webSearchEnabled !== undefined) {
    syncMessageData.webSearchEnabled = await encryptValue(message.webSearchEnabled.toString(), passphraseHash);
  }
  if (message.webSearchContextSize) {
    syncMessageData.webSearchContextSize = await encryptValue(message.webSearchContextSize, passphraseHash);
  }
  if (message.attachments && message.attachments.length > 0) {
    const attachmentIds = message.attachments.map((att) => att.id);
    syncMessageData.attachmentIds = await encryptValue(JSON.stringify(attachmentIds), passphraseHash);
  }

  return {
    machine_id: syncManager.getMachineId(),
    user_id: userId,
    data: syncMessageData,
    version: Date.now(),
  };
}
