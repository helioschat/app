<script lang="ts">
  import { chats, loadChat } from '$lib/stores/chat';
  import { selectedModel } from '$lib/settings/SettingsManager';
  import type { Message } from '$lib/types';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { streamStates, getStreamState, type StreamContextMessage } from '$lib/utils/streamState';
  import { browser } from '$app/environment';
  import { StreamController } from '$lib/utils/StreamController';
  import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
  import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import Spinner from '$lib/components/common/Spinner.svelte';

  let activeChat = $derived($chats.find((chat) => chat.id === page.params.chatId));
  const chatId = $derived(page.params.chatId);

  // Derive state from the streamStates store for the current chat
  const currentStreamState = $derived($streamStates[chatId]);

  let userInput = $state('');
  let isLoading = $derived(currentStreamState?.isStreaming || false);
  let currentlyStreamingMessageId = $derived(currentStreamState?.messageId || '');
  let showResumeButton = $state(false);
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
      const chat = await loadChat(chatId);

      // After the chat is loaded, check for any streaming messages to resume
      if (chat) {
        const currentState = getStreamState(chatId);

        // If there's a stream in progress for this thread
        if (currentState && currentState.isStreaming) {
          // Get the content that was already generated
          const partialContent = currentState.partialContent || '';

          // Get the message that was being streamed
          const messageIndex = chat.messages.findIndex((m: Message) => m.id === currentState.messageId);

          // If we found the message and it's from the assistant
          if (messageIndex >= 0 && chat.messages[messageIndex].role === 'assistant') {
            // Check if we have partial content that was saved
            if (partialContent && partialContent.length > 0) {
              // Update the message with the partial content that was saved
              chats.update((allChats) => {
                return allChats.map((c) => {
                  if (c.id === chatId) {
                    const updatedMessages = [...c.messages];
                    updatedMessages[messageIndex] = {
                      ...updatedMessages[messageIndex],
                      content: partialContent
                    };
                    return { ...c, messages: updatedMessages };
                  }
                  return c;
                });
              });

              // Show resume button
              showResumeButton = true;
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

    try {
      await streamController.handleSubmit(initialMessage, activeChat, $selectedModel.modelId);
    } catch (error) {
      console.error('Error in handleInitialMessage:', error);
    } finally {
      streamController = null;
    }
  }

  // Resume a streaming message that was interrupted
  async function handleResumeGeneration() {
    if (!activeChat) return;
    const controller = getControllerForCurrentChat();
    if (!controller) return;
    streamController = controller;

    const currentState = getStreamState(chatId);
    if (!currentState || !currentState.isStreaming) {
      // No active stream for this chat, or stream state is out of sync
      showResumeButton = false;
      return;
    }

    const messageIndex = activeChat.messages.findIndex((m) => m.id === currentState.messageId);
    if (messageIndex < 0) return;

    if (!$selectedModel) {
      console.error('Cannot resume generation without a selected model.');
      return;
    }

    try {
      // Get the context messages from the state or rebuild them
      let contextMessages: StreamContextMessage[] = currentState.contextMessages || [];
      if (!contextMessages || contextMessages.length === 0) {
        // Rebuild context from chat history if not in stream state
        contextMessages = activeChat.messages.slice(0, messageIndex).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content
        }));
      }

      await streamController.resumeStream(
        contextMessages,
        currentState.messageId,
        activeChat,
        $selectedModel.modelId
      );
    } catch (error) {
      console.error('Error in handleResumeGeneration:', error);
    } finally {
      streamController = null;
    }
  }

  // Handle stopping the current generation
  async function handleStop() {
    if (!streamController) {
      // As a fallback, create a controller to ensure stop can be called
      const controller = getControllerForCurrentChat();
      if (!controller) return;
      await controller.cancelStream();
    } else {
      await streamController.cancelStream();
    }
    streamController = null;
  }

  // Handle regenerating a message
  async function handleRegenerate(message: Message) {
    if (!activeChat || isLoading || !$selectedModel) return;
    const controller = getControllerForCurrentChat();
    if (!controller) return;
    streamController = controller;

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

      // Remove all messages from the one we're regenerating onwards
      chats.update((allChats) => {
        return allChats.map((c) => {
          if (c.id === activeChat?.id) {
            return {
              ...c,
              messages: c.messages.slice(0, messageIndex - 1),
              updatedAt: new Date()
            };
          }
          return c;
        });
      });

      // Use the StreamController to handle the regeneration
      await streamController.handleSubmit(
        previousUserMessage.content,
        activeChat,
        $selectedModel.modelId
      );
    } catch (error) {
      console.error('Error in handleRegenerate:', error);
    } finally {
      streamController = null;
    }
  }

  // Update handleSubmit to use StreamController
  async function handleSubmit(e?: Event) {
    if (e) e.preventDefault();
    if (!activeChat || !userInput.trim() || isLoading || !$selectedModel) return;
    const controller = getControllerForCurrentChat();
    if (!controller) return;
    streamController = controller;

    const inputValue = userInput;
    userInput = '';

    try {
      await streamController.handleSubmit(inputValue, activeChat, $selectedModel.modelId);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      streamController = null;
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
