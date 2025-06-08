<script lang="ts">
  import { chats, activeChatId, loadChat } from '$lib/stores/chat';
  import { providerSettings, selectedProvider } from '$lib/stores/settings';
  import type { Message } from '$lib/types';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { streamState, type StreamContextMessage } from '$lib/utils/streamState';
  import { browser } from '$app/environment';
  import { StreamController } from '$lib/utils/StreamController';
  import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
  import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import Spinner from '$lib/components/common/Spinner.svelte';

  let activeChat = $derived($chats.find((chat) => chat.id === page.params.chatId));

  let userInput = $state('');
  let isLoading = $state(false);
  let currentlyStreamingMessageId = $state('');
  let showResumeButton = $state(false);
  let partialContent = $state('');
  let initialMessageProcessed = $state(false);

  let streamController: StreamController;

  // Set active chat based on URL parameter and initialize StreamController
  $effect(() => {
    const chatId = page.params.chatId;
    if (chatId) {
      activeChatId.set(chatId);
      streamController = new StreamController(chatId, $selectedProvider, $providerSettings[$selectedProvider] || {});
    }
  });

  // Check for initial messages that need a response
  $effect(() => {
    if (
      activeChat &&
      streamController &&
      !isLoading &&
      !initialMessageProcessed &&
      activeChat.messages.length === 1 &&
      activeChat.messages[0].role === 'user'
    ) {
      // We have a chat with only an initial user message, trigger the AI response
      initialMessageProcessed = true;

      // Hack: Use setTimeout to ensure the UI is ready
      setTimeout(() => {
        handleInitialMessage(activeChat.messages[0].content);
      }, 100);
    }
  });

  // Update StreamController when provider changes
  $effect(() => {
    if (streamController) {
      streamController.updateProvider($selectedProvider, $providerSettings[$selectedProvider] || {});
    }
  });

  // Update the onMount section to use loadChat and handle interrupted streams
  onMount(() => {
    const loadChatData = async () => {
      // Try to load the chat from our store or database
      const chat = await loadChat(page.params.chatId);

      // After the chat is loaded, check for any streaming messages to resume
      if (chat) {
        const currentState = $streamState;

        // If there's a stream in progress for this thread
        if (currentState && currentState.threadId === page.params.chatId && currentState.isStreaming) {
          // Get the content that was already generated
          partialContent = currentState.partialContent || '';

          // Get the message that was being streamed
          const messageIndex = chat.messages.findIndex((m: Message) => m.id === currentState.messageId);

          // If we found the message and it's from the assistant
          if (messageIndex >= 0 && chat.messages[messageIndex].role === 'assistant') {
            // Check if we have partial content that was saved
            if (partialContent && partialContent.length > 0) {
              // Update the message with the partial content that was saved
              chats.update((allChats) => {
                return allChats.map((c) => {
                  if (c.id === page.params.chatId) {
                    const updatedMessages = [...c.messages];
                    updatedMessages[messageIndex] = {
                      ...updatedMessages[messageIndex],
                      content: partialContent,
                    };

                    return {
                      ...c,
                      messages: updatedMessages,
                      updatedAt: new Date(),
                    };
                  }
                  return c;
                });
              });

              // Show resume button
              showResumeButton = true;
              currentlyStreamingMessageId = currentState.messageId;
            }
          }
        }
      }
    };

    if (browser) {
      loadChatData();
    }
  });

  // Handler for initial messages
  async function handleInitialMessage(initialMessage: string) {
    if (!activeChat || isLoading || !streamController) return;

    // Use the StreamController to handle the initial message
    const state = await streamController.handleSubmit(initialMessage, activeChat);

    // Update UI state from controller
    isLoading = state.isLoading;
    showResumeButton = state.showResumeButton;
    currentlyStreamingMessageId = state.currentlyStreamingMessageId;
  }

  // Resume a streaming message that was interrupted
  async function handleResumeGeneration() {
    if (!activeChat) return;

    const currentState = $streamState;
    if (!currentState) return;

    const messageIndex = activeChat.messages.findIndex((m) => m.id === currentState.messageId);
    if (messageIndex < 0) return;

    // Get the context messages from the state or rebuild them
    let contextMessages: StreamContextMessage[] = currentState.contextMessages || [];
    if (!contextMessages || contextMessages.length === 0) {
      // We need to rebuild the context
      // Include previous messages for context, up to the current one
      contextMessages = activeChat.messages.slice(0, messageIndex + 1).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        provider: m.provider,
        model: m.model,
        usage: m.usage,
        metrics: m.metrics,
      }));
    }

    // Use the StreamController to resume
    const state = await streamController.resumeStream(contextMessages, currentState.messageId, activeChat);

    // Update UI state from controller
    isLoading = state.isLoading;
    showResumeButton = state.showResumeButton;
    currentlyStreamingMessageId = state.currentlyStreamingMessageId;
  }

  // Update handleSubmit to use StreamController
  async function handleSubmit(e?: Event) {
    if (e) e.preventDefault();
    if (!userInput.trim() || !activeChat || isLoading || !streamController) return;

    const inputValue = userInput;
    userInput = '';

    // Use the StreamController to handle the submission
    const state = await streamController.handleSubmit(inputValue, activeChat);

    // Update UI state from controller
    isLoading = state.isLoading;
    showResumeButton = state.showResumeButton;
    currentlyStreamingMessageId = state.currentlyStreamingMessageId;
  }
</script>

<main class="chat relative flex h-full flex-1 flex-col">
  {#if activeChat}
    <div class="header-container absolute top-0 left-1/2 w-full -translate-x-1/2">
      <ChatHeader chat={activeChat}></ChatHeader>
    </div>

    <div class="messages-container h-full overflow-y-auto pt-16 pb-24">
      <ChatMessages
        chat={activeChat}
        {isLoading}
        {showResumeButton}
        {currentlyStreamingMessageId}
        {handleResumeGeneration}></ChatMessages>
    </div>

    <div class="input-component absolute bottom-0 left-1/2 w-full -translate-x-1/2">
      <ChatInput bind:userInput {isLoading} {handleSubmit}></ChatInput>
    </div>
  {:else}
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <Spinner></Spinner>
      </div>
    </div>
  {/if}
</main>

<style lang="postcss">
  .input-component {
    background: linear-gradient(to top, var(--color-1) 50%, transparent);
  }
</style>
