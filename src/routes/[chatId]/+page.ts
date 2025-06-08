import { browser } from '$app/environment';
import { getThread } from '$lib/utils/db';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  // During SSR, we need to check if the chat exists
  if (!browser) {
    return {
      chatId: params.chatId,
    };
  }

  // In the browser, we can check if the thread exists
  const thread = await getThread(params.chatId);

  // If thread doesn't exist, redirect to home
  if (!thread) {
    throw redirect(302, '/');
  }

  return {
    chatId: params.chatId,
  };
};
