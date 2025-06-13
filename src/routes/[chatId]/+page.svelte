<script lang="ts">
  import { chats, loadChat, clearTemporaryChats } from '$lib/stores/chat';
  import { selectedModel } from '$lib/settings/SettingsManager';
  import type { Message, Attachment } from '$lib/types';
  import { page } from '$app/stores';
  import { tick, onMount, onDestroy } from 'svelte';
  import { streamStates, endStream } from '$lib/streaming';
  import { browser } from '$app/environment';
  import { StreamingController } from '$lib/streaming';
  import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
  import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import Spinner from '$lib/components/common/Spinner.svelte';

  $: chatId = $page.params.chatId;
  $: activeChat = $chats.find((chat) => chat.id === chatId);
  $: currentStreamState = $streamStates[chatId];
  $: isLoading = currentStreamState?.isStreaming ?? false;
  $: currentlyStreamingMessageId = currentStreamState?.messageId ?? '';

  let userInput = '';
  let initialMessageProcessed = false;

  // Map provides clearer semantics and easier cleanup than a plain object
  const streamControllers = new Map<string, StreamingController>();

  /**
   * Retrieves or creates a StreamingController for a given chat ID.
   * This ensures that each chat has its own controller, allowing for concurrent streams.
   */
  function getOrCreateStreamController(id: string): StreamingController {
    let controller = streamControllers.get(id);
    if (!controller) {
      controller = new StreamingController(id);
      streamControllers.set(id, controller);
    }
    return controller;
  }

  /**
   * Handles the submission of a new message from the user.
   */
  async function handleSubmit(_: Event, attachments?: Attachment[]) {
    const messageContent = userInput;
    if (
      (!messageContent.trim() && (!attachments || attachments.length === 0)) ||
      !activeChat ||
      isLoading ||
      !$selectedModel
    )
      return;

    const controller = getOrCreateStreamController(chatId);
    userInput = ''; // Clear input
    controller.handleSubmit(
      messageContent,
      activeChat,
      $selectedModel.providerInstanceId,
      $selectedModel.modelId,
      attachments,
    );
  }

  /**
   * Handles the "Stop" button action to cancel an in-progress stream.
   */
  async function handleStop() {
    const controller = streamControllers.get(chatId);
    if (controller) {
      await controller.cancelStream();
    } else {
      // If no controller exists but the state is stuck, force cleanup.
      endStream(chatId);
    }
  }

  /**
   * Handles the "Regenerate" button action for an assistant message.
   */
  async function handleRegenerate(messageToRegenerate: Message) {
    if (!activeChat || isLoading) return;

    const messageIndex = activeChat.messages.findIndex((m) => m.id === messageToRegenerate.id);
    if (messageIndex < 1 || activeChat.messages[messageIndex].role !== 'assistant') {
      console.error('Cannot regenerate: not a valid assistant message.');
      return;
    }

    // Use the message's stored provider and model information
    const storedProviderInstanceId = messageToRegenerate.providerInstanceId;
    const storedModelId = messageToRegenerate.model;

    if (!storedProviderInstanceId || !storedModelId) {
      console.error('Cannot regenerate: message does not have stored provider or model information.');
      return;
    }

    const previousMessage = activeChat.messages[messageIndex - 1];
    if (previousMessage.role !== 'user') {
      console.error('Cannot regenerate: previous message was not from the user.');
      return;
    }

    const originalUserInput = previousMessage.content;
    const originalAttachments = previousMessage.attachments;

    // Truncate chat history to the point *before* the user message we are regenerating from.
    const truncatedMessages = activeChat.messages.slice(0, messageIndex - 1);

    chats.update((allChats) => {
      const chatIndex = allChats.findIndex((c) => c.id === chatId);
      if (chatIndex !== -1) {
        allChats[chatIndex] = {
          ...allChats[chatIndex],
          messages: truncatedMessages,
          updatedAt: new Date(),
        };
      }
      return allChats;
    });

    // Wait for Svelte to process the store update.
    await tick();

    // Resubmit the original user prompt to the now-truncated chat.
    const controller = getOrCreateStreamController(chatId);
    const updatedChat = $chats.find((c) => c.id === chatId);
    if (!updatedChat) return;

    await controller.handleSubmit(
      originalUserInput,
      updatedChat,
      storedProviderInstanceId,
      storedModelId,
      originalAttachments,
    );
  }

  onMount(() => {
    async function setupChat() {
      const chat = await loadChat(chatId);
      if (chat) {
        const currentStreamState = $streamStates[chatId];
        if (currentStreamState?.isStreaming) {
          // This stream is stuck, clean it up.
          endStream(chatId);
        }
      }
    }

    if (browser) {
      setupChat();
    }
  });

  onDestroy(() => {
    // Clean up the controller for this chat if it's not streaming, to save memory.
    const controller = streamControllers.get(chatId);
    if (controller && !$streamStates[chatId]?.isStreaming) {
      streamControllers.delete(chatId);
    }

    // Clean up temporary chats when navigating away
    if (browser) {
      clearTemporaryChats();
    }
  });

  $: if (
    browser &&
    activeChat &&
    !isLoading &&
    !initialMessageProcessed &&
    activeChat.messages.length === 1 &&
    activeChat.messages[0].role === 'user'
  ) {
    initialMessageProcessed = true;
    // Hack: Use a timeout to ensure other reactive updates have settled before starting the stream.
    setTimeout(() => {
      const controller = getOrCreateStreamController(chatId);
      if (controller && $selectedModel) {
        controller.handleSubmit(
          activeChat.messages[0].content,
          activeChat,
          $selectedModel.providerInstanceId,
          $selectedModel.modelId,
          activeChat.messages[0].attachments,
        );
      }
    }, 100);
  }
</script>

<main class="chat relative flex h-full flex-1 flex-col">
  {#if activeChat}
    <div class="header-container absolute top-0 left-1/2 w-full -translate-x-1/2">
      <ChatHeader chat={activeChat}></ChatHeader>
    </div>

    <div class="messages-container -mb-30 h-full overflow-y-auto">
      <ChatMessages chat={activeChat} {currentlyStreamingMessageId} {handleRegenerate}></ChatMessages>
    </div>

    <div class="input-container">
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
  .input-container {
    background-image: linear-gradient(to top, var(--color-1), transparent);
    background-size: 100% 120px;
    background-repeat: no-repeat;
  }
</style>
