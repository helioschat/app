<script lang="ts">
  import { chats, loadChat } from '$lib/stores/chat';
  import { selectedModel } from '$lib/settings/SettingsManager';
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

  let streamController = $state<StreamController | null>(null);

  // When the selected provider changes, we need to reset the stream controller
  // so that a new one is created with the correct provider instance.
  $effect(() => {
    // This effect should react to changes in the selected provider instance
    // eslint-disable-next-line no-unused-expressions
    $selectedModel;

    if (streamController) {
      streamController = null;
    }
  });

  function getControllerForCurrentChat(): StreamController | null {
    if (!activeChat) return null;

    // First, try to use the provider ID associated with the chat
    // If not available, fall back to the globally selected provider
    const providerId = activeChat.providerInstanceId || $selectedModel?.providerInstanceId;

    if (!providerId) {
      console.error('No provider configured for this chat and no fallback is selected.');
      return null;
    }

    // Create a new StreamController with the chat ID and correct provider ID
    return new StreamController(activeChat.id, providerId);
  }

  // Check for initial messages that need a response
  $effect(() => {
    if (
      activeChat &&
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
    if (!activeChat || isLoading || !$selectedModel) return;
    const controller = getControllerForCurrentChat();
    if (!controller) return;
    streamController = controller;

    // Set loading state immediately
    isLoading = true;

    try {
      const state = await streamController.handleSubmit(initialMessage, activeChat, $selectedModel.modelId);

      // Update UI state from controller
      isLoading = state.isLoading;
      showResumeButton = state.showResumeButton;
      currentlyStreamingMessageId = state.currentlyStreamingMessageId;
    } catch (error) {
      console.error('Error in handleInitialMessage:', error);
      isLoading = false;
    } finally {
      if (!isLoading) streamController = null;
    }
  }

  // Resume a streaming message that was interrupted
  async function handleResumeGeneration() {
    if (!activeChat) return;
    const controller = getControllerForCurrentChat();
    if (!controller) return;
    streamController = controller;

    const currentState = $streamState;
    if (!currentState) return;

    // Use the model from the stream state if available, otherwise use the currently selected model
    const modelId = currentState.contextMessages?.[0]?.model || $selectedModel?.modelId;
    if (!modelId) {
      console.error('No model ID found to resume stream.');
      isLoading = false;
      return;
    }

    const messageIndex = activeChat.messages.findIndex((m) => m.id === currentState.messageId);
    if (messageIndex < 0) return;

    // Set loading state immediately
    isLoading = true;

    try {
      // Get the context messages from the state or rebuild them
      let contextMessages: StreamContextMessage[] = currentState.contextMessages || [];
      if (!contextMessages || contextMessages.length === 0) {
        // We need to rebuild the context
        // Include previous messages for context, up to the current one
        contextMessages = activeChat.messages.slice(0, messageIndex + 1).map((m: Message) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          provider: m.provider,
          providerInstanceId: m.providerInstanceId,
          model: m.model,
          usage: m.usage,
          metrics: m.metrics,
        }));
      }

      // Use the StreamController to resume
      const state = await streamController.resumeStream(contextMessages, currentState.messageId, activeChat, modelId);

      // Update UI state from controller
      isLoading = state.isLoading;
      showResumeButton = state.showResumeButton;
      currentlyStreamingMessageId = state.currentlyStreamingMessageId;
    } catch (error) {
      console.error('Error in handleResumeGeneration:', error);
      isLoading = false;
    } finally {
      if (!isLoading) streamController = null;
    }
  }

  // Handle stopping the current generation
  async function handleStop() {
    if (!streamController) return;
    await streamController.cancelStream();
    streamController = null;
    isLoading = false;
  }

  // Handle regenerating a message
  async function handleRegenerate(message: Message) {
    if (!activeChat || isLoading || !$selectedModel) return;
    const controller = getControllerForCurrentChat();
    if (!controller) return;
    streamController = controller;

    // Set loading state immediately
    isLoading = true;

    try {
      // Find the message index
      const messageIndex = activeChat.messages.findIndex((m) => m.id === message.id);
      if (messageIndex < 0) return;

      // Get the previous user message
      const previousUserMessage = activeChat.messages[messageIndex - 1];
      if (!previousUserMessage || previousUserMessage.role !== 'user') {
        console.error('No previous user message found for regeneration');
        return;
      }

      // Remove all messages after the one we're regenerating
      chats.update((allChats) => {
        return allChats.map((c) => {
          if (c.id === activeChat?.id) {
            return {
              ...c,
              messages: c.messages.slice(0, messageIndex),
              updatedAt: new Date(),
            };
          }
          return c;
        });
      });

      // Use the StreamController to handle the regeneration
      const state = await streamController.handleSubmit(
        previousUserMessage.content,
        activeChat,
        $selectedModel.modelId,
      );

      // Update UI state from controller
      isLoading = state.isLoading;
      showResumeButton = state.showResumeButton;
      currentlyStreamingMessageId = state.currentlyStreamingMessageId;
    } catch (error) {
      console.error('Error in handleRegenerate:', error);
      isLoading = false;
    } finally {
      if (!isLoading) streamController = null;
    }
  }

  // Update handleSubmit to use StreamController
  async function handleSubmit(e?: Event) {
    if (e) e.preventDefault();
    if (!activeChat || !userInput.trim() || isLoading || !$selectedModel) return;
    const controller = getControllerForCurrentChat();
    if (!controller) return;
    streamController = controller;

    isLoading = true;
    const inputValue = userInput;
    userInput = '';

    try {
      const state = await streamController.handleSubmit(inputValue, activeChat, $selectedModel.modelId);

      // Update UI state from controller
      isLoading = state.isLoading;
      showResumeButton = state.showResumeButton;
      currentlyStreamingMessageId = state.currentlyStreamingMessageId;
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      isLoading = false;
    } finally {
      if (!isLoading) streamController = null;
    }
  }
</script>

<main class="chat relative flex h-full flex-1 flex-col">
  {#if activeChat}
    <div class="header-container absolute top-0 left-1/2 w-full -translate-x-1/2">
      <ChatHeader chat={activeChat}></ChatHeader>
    </div>

    <div class="messages-container h-full overflow-y-auto">
      <ChatMessages
        chat={activeChat}
        {isLoading}
        {showResumeButton}
        {currentlyStreamingMessageId}
        {handleResumeGeneration}
        {handleRegenerate}></ChatMessages>
    </div>

    <div class="input-component absolute bottom-0 left-1/2 w-full -translate-x-1/2">
      <ChatInput bind:userInput {isLoading} {handleSubmit} {handleStop}></ChatInput>
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
