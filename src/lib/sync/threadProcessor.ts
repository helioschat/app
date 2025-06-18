import { getChatFromThread, saveChatAsThreadAndMessages } from '$lib/database/chat';
import { deleteMessage, saveMessage } from '$lib/database/messages';
import type { Thread } from '$lib/database/types';
import { authState, syncManager } from '$lib/stores/sync';
import type { Chat, MessageWithAttachments } from '$lib/types';
import { get } from 'svelte/store';
import type { SyncAPIClient } from './api';
import { chatToThread, messageToSyncMessage, threadToSyncThread } from './converters';

/**
 * Process message changes and sync them to the server
 */
export async function processMessageChanges(
  messageChanges: Array<{
    type: 'added' | 'modified' | 'deleted';
    message: MessageWithAttachments & { threadId: string };
  }>,
  userId: string,
  passphraseHash: string,
  apiClient: SyncAPIClient,
): Promise<void> {
  for (const change of messageChanges) {
    try {
      const { type, message } = change;

      if (type !== 'deleted') {
        const syncMessage = await messageToSyncMessage(message, userId, passphraseHash);
        const response = await syncManager.makeAuthenticatedRequest(() =>
          apiClient.upsertMessage(message.id, syncMessage),
        );

        if (response.success) {
          console.log(`Successfully synced ${type} message: ${message.id}`);
        } else {
          console.error(`Failed to sync ${type} message ${message.id}:`, response.error);
        }
      }
    } catch (error) {
      console.error(`Error syncing ${change.type} message ${change.message.id}:`, error);
    }
  }
}

/**
 * Process thread changes and prepare them for syncing
 */
export async function processThreadChanges(chats: Chat[]): Promise<void> {
  const auth = get(authState);
  if (!auth.isAuthenticated || !auth.userId) {
    throw new Error('User not authenticated');
  }

  const apiClient = syncManager.getAPIClient();
  if (!apiClient) {
    throw new Error('API client not available');
  }

  const syncSettings = get(syncManager.syncSettings);
  if (!syncSettings.passphraseHash) {
    throw new Error('No passphrase hash available for encryption');
  }

  // Removed message sync logic; chat message processing should be handled elsewhere
  const threads = chats.map(chatToThread);
  for (const thread of threads) {
    try {
      const syncThreadReq = await threadToSyncThread(thread, auth.userId, syncSettings.passphraseHash);
      const response = await syncManager.makeAuthenticatedRequest(() =>
        apiClient.upsertThread(thread.id, syncThreadReq),
      );

      if (response.success) {
        console.log(`Successfully synced thread: ${thread.id}`);
      } else {
        console.error(`Failed to sync thread ${thread.id}:`, response.error);
      }
    } catch (error) {
      console.error(`Error syncing thread ${thread.id}:`, error);
    }
  }
}

/**
 * Handle incoming message updates from sync server
 */
export async function handleIncomingMessageUpdates(
  messageUpdates: Array<{
    operation: 'add' | 'update' | 'delete';
    threadId: string;
    message?: MessageWithAttachments;
    messageId?: string;
  }>,
): Promise<void> {
  if (messageUpdates.length === 0) return;

  const { chats } = await import('$lib/stores/chat');
  for (const update of messageUpdates) {
    chats.update((allChats) => {
      const chat = allChats.find((c) => c.id === update.threadId);
      if (!chat) return allChats;
      if (update.operation === 'delete' && update.messageId) {
        chat.messages = chat.messages.filter((m) => m.id !== update.messageId);
        deleteMessage(update.messageId).catch(console.error);
      } else if (update.message) {
        const idx = chat.messages.findIndex((m) => m.id === update.message?.id);
        if (idx > -1) chat.messages[idx] = update.message;
        else chat.messages.push(update.message);
        saveMessage({ ...update.message, threadId: update.threadId }).catch(console.error);
      }
      chat.updatedAt = new Date();
      return allChats;
    });
  }
}

/**
 * Handle incoming thread updates from sync server
 */
export async function handleIncomingThreadUpdates(threads: Thread[]): Promise<void> {
  if (threads.length === 0) return;

  const { chats } = await import('$lib/stores/chat');
  const toSave: Chat[] = [];
  for (const thread of threads) {
    const existing = await getChatFromThread(thread.id);
    if (existing) {
      chats.update((allChats) => {
        const chat = allChats.find((c) => c.id === thread.id);
        if (!chat) return allChats;
        Object.assign(chat, {
          title: thread.title,
          pinned: thread.pinned,
          providerInstanceId: thread.providerInstanceId,
          model: thread.model,
          branchedFrom: thread.branchedFrom,
          webSearchEnabled: thread.webSearchEnabled,
          webSearchContextSize: thread.webSearchContextSize,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        });
        toSave.push(chat);
        return allChats;
      });
    } else {
      const newChat: Chat = {
        id: thread.id,
        title: thread.title,
        messages: [],
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        providerInstanceId: thread.providerInstanceId,
        model: thread.model,
        pinned: thread.pinned,
        branchedFrom: thread.branchedFrom,
        webSearchEnabled: thread.webSearchEnabled,
        webSearchContextSize: thread.webSearchContextSize,
      };
      chats.update((allChats) => {
        if (!allChats.find((c) => c.id === thread.id)) {
          toSave.push(newChat);
          allChats.push(newChat);
        }
        return allChats;
      });
    }
  }
  for (const chat of toSave) saveChatAsThreadAndMessages(chat).catch(console.error);
}
