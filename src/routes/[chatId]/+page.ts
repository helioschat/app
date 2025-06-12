import { browser } from '$app/environment';
import { getThread } from '$lib/database';
import { chats } from '$lib/stores/chat';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  // During SSR, we need to check if the chat exists
  if (!browser) {
    return {
      chatId: params.chatId,
    };
  }

  // Check if the chat exists in the store (for temporary chats)
  const currentChats = get(chats);
  const chatInStore = currentChats.find((chat) => chat.id === params.chatId);

  // If it's a temporary chat, allow it
  if (chatInStore && chatInStore.temporary) {
    return {
      chatId: params.chatId,
    };
  }

  // For non-temporary chats, check if the thread exists in IndexedDB
  const thread = await getThread(params.chatId);

  // If thread doesn't exist, redirect to home
  if (!thread) {
    throw redirect(302, '/');
  }

  return {
    chatId: params.chatId,
  };
};
