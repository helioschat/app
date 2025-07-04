import { browser } from '$app/environment';
import {
  deleteThread,
  getAllThreads,
  getChatFromThread,
  saveChatAsThreadAndMessages,
  type Thread,
} from '$lib/database';
import { streamStates } from '$lib/streaming';
import { syncThread } from '$lib/sync';
import type { Attachment, Chat } from '$lib/types';
import { generateChatTitle } from '$lib/utils/titleGeneration';
import { get, writable, type Writable } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';

// Initial chat template
const createInitialChat = (): Chat => ({
  id: uuidv7(),
  title: 'New Chat',
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Initialize stores with empty values, then load from IndexedDB
export const chats: Writable<Chat[]> = writable<Chat[]>([]);
export const activeChatId: Writable<string | null> = writable<string | null>(null);
export const isLoadingChats: Writable<boolean> = writable<boolean>(false);
export const isInitializing: Writable<boolean> = writable<boolean>(false);

// Helper to sort chats by updatedAt in descending order
function sortChats(chatList: Chat[]): Chat[] {
  return [...chatList].sort((a, b) => {
    // First sort by pinned status
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Then sort by updatedAt
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

if (browser) {
  // Load chats from IndexedDB
  const initializeStore = async () => {
    try {
      // Set initialization flag to prevent sync during initial load
      isInitializing.set(true);

      const threads = await getAllThreads();

      if (threads.length > 0) {
        const CHUNK_SIZE = 16;
        const loadChunk = async (startIndex: number) => {
          const chunk = threads.slice(startIndex, startIndex + CHUNK_SIZE);
          const chunkChats = await Promise.all(
            chunk.map(async (thread: Thread) => {
              const chat = await getChatFromThread(thread.id);
              return chat || createEmptyChatFromThread(thread);
            }),
          );
          return chunkChats;
        };

        // Set loading state
        isLoadingChats.set(true);

        // Load first chunk immediately
        const initialChats = await loadChunk(0);
        chats.set(sortChats(initialChats));

        // Set the most recently updated chat as active
        activeChatId.set(threads[0].id);

        // Load remaining chunks in the background
        if (threads.length > CHUNK_SIZE) {
          const loadRemainingChunks = async () => {
            let currentIndex = CHUNK_SIZE;

            while (currentIndex < threads.length) {
              const chunkChats = await loadChunk(currentIndex);
              chats.update((existingChats) => sortChats([...existingChats, ...chunkChats]));
              currentIndex += CHUNK_SIZE;

              // Small delay between chunks to prevent UI blocking
              await new Promise((resolve) => setTimeout(resolve, 50));
            }

            // Done loading
            isLoadingChats.set(false);
            isInitializing.set(false);
          };

          // Start loading remaining chunks
          loadRemainingChunks();
        } else {
          // No more chunks to load
          isLoadingChats.set(false);
          isInitializing.set(false);
        }
      } else {
        // No threads to load
        isInitializing.set(false);
      }
    } catch (error) {
      console.error('Error initializing chat store:', error);
      isLoadingChats.set(false);
      isInitializing.set(false);
    }
  };

  initializeStore();

  // Subscribe to activeChatId to ensure messages are loaded
  activeChatId.subscribe(async (id) => {
    if (!id) return;

    // Check if the chat is already loaded with messages
    let currentChats: Chat[] = [];
    const unsubscribe = chats.subscribe((value) => {
      currentChats = value;
    });
    unsubscribe();

    const activeChat = currentChats.find((chat) => chat.id === id);

    // If the chat exists but has no messages, load them
    if (activeChat && activeChat.messages.length === 0) {
      const fullChat = await getChatFromThread(id);
      if (fullChat) {
        chats.update((allChats) => allChats.map((chat) => (chat.id === id ? fullChat : chat)));
      }
    }
  });

  // Subscribe to chats store to update IndexedDB
  chats.subscribe(async (chatList) => {
    if (chatList.length > 0) {
      let currentActiveChatId: string | null = null;
      const unsubscribe = activeChatId.subscribe((id) => {
        currentActiveChatId = id;
      });
      unsubscribe();

      // Only save the active chat to IndexedDB when it changes
      // This improves performance by not saving all chats every time
      // Skip temporary chats and chats currently streaming to reduce writes
      if (currentActiveChatId) {
        const activeChat = chatList.find((chat) => chat.id === currentActiveChatId);
        if (activeChat) {
          const streamingState = get(streamStates)[activeChat.id];
          const isStreaming = streamingState?.isStreaming ?? false;
          if (!activeChat.temporary && !isStreaming) {
            await saveChatAsThreadAndMessages(activeChat);
          }
        }
      }
    }
  });
}

// Simple mutex to prevent concurrent loads of the same chat
const loadMutex: Record<string, Promise<Chat | null>> = {};

/**
 * Generates and updates the title for a chat asynchronously
 * @param chatId The ID of the chat to update
 * @param userMessage The user message to generate title from
 * @param providerInstanceId Optional provider instance ID to use for generation
 */
async function generateTitleForChat(chatId: string, userMessage: string, providerInstanceId?: string): Promise<void> {
  try {
    const generatedTitle = await generateChatTitle(userMessage, providerInstanceId);

    // Update the chat title in the store
    chats.update((allChats) => {
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
        // Sync the updated thread
        syncThread(updatedChat);
      }

      return [...allChats];
    });
  } catch (error) {
    console.error('Failed to generate chat title:', error);
    // Title generation failure is not critical, so we don't need to do anything
  }
}

/**
 * Creates a new chat and returns its ID
 * @param initialMessage Optional initial message to add to the chat
 * @param temporary Whether this chat should be temporary (not saved to IndexedDB)
 * @param attachments Optional attachments for the initial message
 * @param providerInstanceId Optional provider instance ID for title generation
 * @param webSearchEnabled Whether web search should be enabled for this chat
 * @param webSearchContextSize Web search context size
 */
export function createNewChat(
  initialMessage?: string,
  temporary?: boolean,
  attachments?: Attachment[],
  providerInstanceId?: string,
  webSearchEnabled?: boolean,
  webSearchContextSize?: 'low' | 'medium' | 'high',
): string {
  const newChat: Chat = createInitialChat();

  // Mark as temporary if specified
  if (temporary) {
    newChat.temporary = true;
  }

  // Set web search options if specified
  if (webSearchEnabled !== undefined) {
    newChat.webSearchEnabled = webSearchEnabled;
  }
  if (webSearchContextSize !== undefined) {
    newChat.webSearchContextSize = webSearchContextSize;
  }

  // If an initial message is provided OR attachments exist, add it as a user message
  const hasText = initialMessage && initialMessage.trim();
  const hasAttachments = attachments && attachments.length > 0;

  if (hasText || hasAttachments) {
    const trimmedText = hasText ? (initialMessage as string).trim() : '';

    // Set initial title - this may be updated by generateTitleForChat
    if (hasText) {
      newChat.title = trimmedText.length > 30 ? trimmedText.substring(0, 30) + '...' : trimmedText;
    } else if (hasAttachments) {
      newChat.title = 'Attachments';
    }

    newChat.messages.push({
      id: uuidv7(),
      role: 'user',
      content: trimmedText,
      attachments: attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate a better title asynchronously if we have text
    if (hasText && !temporary) {
      generateTitleForChat(newChat.id, trimmedText, providerInstanceId);
    }
  }

  chats.update((allChats) => sortChats([...allChats, newChat]));
  activeChatId.set(newChat.id);

  // Only save to IndexedDB if not temporary
  if (browser && !temporary) {
    saveChatAsThreadAndMessages(newChat);
    // Sync the new thread
    syncThread(newChat);
  }

  return newChat.id;
}

/**
 * Deletes a chat by ID
 */
export async function deleteChatById(id: string): Promise<void> {
  // Check if it's a temporary chat before trying to delete from IndexedDB
  let isTemporary = false;
  chats.update((allChats) => {
    const chatToDelete = allChats.find((chat) => chat.id === id);
    if (chatToDelete) {
      isTemporary = !!chatToDelete.temporary;
    }
    return allChats;
  });

  // Remove from store
  chats.update((allChats) => {
    const filtered = allChats.filter((chat) => chat.id !== id);

    // If we're deleting the active chat, set a new active chat
    if (id === get(activeChatId) && filtered.length > 0) {
      activeChatId.set(filtered[0].id);
    } else if (filtered.length === 0) {
      // If no chats remain, create a new one
      const newChat = createInitialChat();
      filtered.push(newChat);
      activeChatId.set(newChat.id);

      // Save the new chat to IndexedDB
      if (browser) {
        saveChatAsThreadAndMessages(newChat);
        // Sync the new thread
        syncThread(newChat);
      }
    }

    return filtered;
  });

  // Only remove from IndexedDB if it's not a temporary chat
  if (!isTemporary) {
    await deleteThread(id);
  }
}

/**
 * Loads a specific chat by ID
 */
export async function loadChat(id: string): Promise<Chat | null> {
  // If we're already loading this chat, wait for that promise
  const existingPromise = loadMutex[id];
  if (existingPromise) {
    return existingPromise;
  }

  // Create a new promise for loading this chat
  loadMutex[id] = (async () => {
    try {
      // Check if the chat is already loaded
      let currentChats: Chat[] = [];
      const unsubscribe = chats.subscribe((value) => {
        currentChats = value;
      });
      unsubscribe();

      const existingChat = currentChats.find((chat) => chat.id === id);
      if (existingChat && existingChat.messages.length > 0) {
        return existingChat;
      }

      // If it's a temporary chat, don't try to load from IndexedDB
      if (existingChat && existingChat.temporary) {
        return existingChat;
      }

      // If not loaded or has no messages, get from IndexedDB
      const chat = await getChatFromThread(id);
      if (chat) {
        // Update the store with the loaded chat
        chats.update((allChats) => {
          const index = allChats.findIndex((c) => c.id === id);
          if (index >= 0) {
            // Replace existing chat
            const updated = [...allChats];
            updated[index] = chat;
            return sortChats(updated);
          } else {
            // Add new chat
            return sortChats([...allChats, chat]);
          }
        });
      }
      return chat;
    } finally {
      // Remove the promise from the mutex once it's resolved
      delete loadMutex[id];
    }
  })();
  return loadMutex[id];
}

/**
 * Creates an empty chat object from a thread (for initial display)
 * This is used when the full chat data with messages hasn't been loaded yet
 * @param thread Thread object from IndexedDB
 */
function createEmptyChatFromThread(thread: Thread): Chat {
  return {
    id: thread.id,
    title: thread.title,
    messages: [],
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    providerInstanceId: thread.providerInstanceId,
    model: thread.model,
    pinned: thread.pinned,
    branchedFrom: thread.branchedFrom,
  };
}

/**
 * Removes all temporary chats from the store
 */
export function clearTemporaryChats(): void {
  chats.update((allChats) => {
    const filteredChats = allChats.filter((chat) => !chat.temporary);
    return sortChats(filteredChats);
  });
}

/**
 * Toggles the pinned status of a chat
 * @param id The ID of the chat to pin/unpin
 */
export async function toggleChatPin(id: string): Promise<void> {
  chats.update((allChats) => {
    const chatIndex = allChats.findIndex((c) => c.id === id);
    if (chatIndex > -1) {
      const chat = allChats[chatIndex];
      chat.pinned = !chat.pinned;
      // Note: Don't update updatedAt here, as it's not required

      // Trigger IndexedDB save
      saveChatAsThreadAndMessages(chat);
      // Sync the updated thread
      syncThread(chat);
    }
    // Return a new array to trigger Svelte reactivity, properly sorted
    return sortChats([...allChats]);
  });
}

/**
 * Edits a message and truncates messages after it
 * @param chatId The ID of the chat containing the message
 * @param messageId The ID of the message to edit
 * @param newContent The new content for the message
 */
export function editMessage(chatId: string, messageId: string, newContent: string): void {
  chats.update((allChats) => {
    const chatIndex = allChats.findIndex((c) => c.id === chatId);
    if (chatIndex === -1) return allChats;

    const chat = allChats[chatIndex];
    const messageIndex = chat.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return allChats;

    // Create new messages array with the edit and truncate after
    const newMessages = chat.messages.slice(0, messageIndex + 1);
    newMessages[messageIndex] = {
      ...newMessages[messageIndex],
      content: newContent,
      updatedAt: new Date(),
    };

    // Update the chat
    const updatedChat = {
      ...chat,
      messages: newMessages,
      updatedAt: new Date(),
    };

    allChats[chatIndex] = updatedChat;

    // Save to IndexedDB if not temporary
    if (browser && !updatedChat.temporary) {
      saveChatAsThreadAndMessages(updatedChat);
      // Sync the updated thread
      syncThread(updatedChat);
    }

    return [...allChats];
  });
}

/**
 * Creates a new chat by branching off from an existing chat up to a specific message
 * @param sourceChatId The ID of the chat to branch from
 * @param upToMessageId The ID of the message to branch up to (inclusive)
 * @returns The ID of the new branched chat
 */
export function branchOffChat(sourceChatId: string, upToMessageId: string): string {
  const sourceChat = get(chats).find((c) => c.id === sourceChatId);
  if (!sourceChat) {
    throw new Error('Source chat not found');
  }

  const messageIndex = sourceChat.messages.findIndex((m) => m.id === upToMessageId);
  if (messageIndex === -1) {
    throw new Error('Message not found in source chat');
  }

  // Create messages up to and including the specified message
  const branchedMessages = sourceChat.messages.slice(0, messageIndex + 1);

  const newChat: Chat = {
    ...sourceChat,
    id: uuidv7(),
    messages: branchedMessages.map((msg) => ({
      ...msg,
      id: uuidv7(), // Generate new IDs for the copied messages
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    branchedFrom: {
      threadId: sourceChat.id,
      messageId: upToMessageId,
    },
    temporary: false, // Branches are not temporary
    pinned: false, // New branches are not pinned by default
  };

  chats.update((allChats) => sortChats([...allChats, newChat]));
  activeChatId.set(newChat.id);

  // Save to IndexedDB
  if (browser) {
    saveChatAsThreadAndMessages(newChat);
    // Sync the new branched thread
    syncThread(newChat);
  }

  return newChat.id;
}
