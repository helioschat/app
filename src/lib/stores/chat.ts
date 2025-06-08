import { browser } from '$app/environment';
import type { Chat } from '$lib/types';
import {
  deleteThread,
  getAllThreads,
  getChatFromThread,
  saveChatAsThreadAndMessages,
  type Thread,
} from '$lib/utils/db';
import { writable, type Writable } from 'svelte/store';
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

// Helper to sort chats by updatedAt in descending order
function sortChats(chatList: Chat[]): Chat[] {
  return [...chatList].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

if (browser) {
  // Load chats from IndexedDB
  const initializeStore = async () => {
    try {
      const threads = await getAllThreads();

      if (threads.length > 0) {
        const CHUNK_SIZE = 16;
        const loadChunk = async (startIndex: number) => {
          const chunk = threads.slice(startIndex, startIndex + CHUNK_SIZE);
          const chunkChats = await Promise.all(
            chunk.map(async (thread) => {
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
          };

          // Start loading remaining chunks
          loadRemainingChunks();
        } else {
          // No more chunks to load
          isLoadingChats.set(false);
        }
      }
    } catch (error) {
      console.error('Error initializing chat store:', error);
      isLoadingChats.set(false);
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
      if (currentActiveChatId) {
        const activeChat = chatList.find((chat) => chat.id === currentActiveChatId);
        if (activeChat) {
          await saveChatAsThreadAndMessages(activeChat);
        }
      }

      // Ensure chats are always sorted
      const sortedChats = sortChats(chatList);
      if (JSON.stringify(sortedChats) !== JSON.stringify(chatList)) {
        chats.set(sortedChats);
      }
    }
  });
}

// Simple mutex to prevent concurrent loads of the same chat
const loadMutex: Record<string, Promise<Chat | null>> = {};

/**
 * Creates a new chat and returns its ID
 * @param initialMessage Optional initial message to add to the chat
 */
export function createNewChat(initialMessage?: string): string {
  const newChat: Chat = createInitialChat();

  // If an initial message is provided, add it as a user message
  if (initialMessage && initialMessage.trim()) {
    initialMessage = initialMessage.trim();

    newChat.title = initialMessage.length > 30 ? initialMessage.substring(0, 30) + '...' : initialMessage;

    newChat.messages.push({
      id: uuidv7(),
      role: 'user',
      content: initialMessage,
    });
  }

  chats.update((allChats) => sortChats([...allChats, newChat]));
  activeChatId.set(newChat.id);

  // Save the new chat to IndexedDB
  if (browser) {
    saveChatAsThreadAndMessages(newChat);
  }

  return newChat.id;
}

/**
 * Deletes a chat by ID
 */
export async function deleteChatById(id: string): Promise<void> {
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
      }
    }

    return filtered;
  });

  // Remove from IndexedDB
  await deleteThread(id);
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
        return chat;
      }

      return null;
    } finally {
      // Clean up the mutex after a delay to prevent immediate duplicate requests
      setTimeout(() => {
        delete loadMutex[id];
      }, 1000);
    }
  })();

  return loadMutex[id];
}

// Helper to get store value without subscription
function get<T>(store: Writable<T>): T {
  let value: T;
  const unsubscribe = store.subscribe((v) => (value = v));
  unsubscribe();
  return value!;
}

// Helper to create an empty chat from a thread
function createEmptyChatFromThread(thread: Thread): Chat {
  return {
    id: thread.id,
    title: thread.title,
    messages: [],
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}
