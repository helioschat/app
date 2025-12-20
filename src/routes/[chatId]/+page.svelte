<script lang="ts">
  import { chats, loadChat, clearTemporaryChats, editMessage, branchOffChat } from '$lib/stores/chat';
  import { selectedModel } from '$lib/settings/SettingsManager';
  import { syncThread } from '$lib/sync';
  import type { Message, Attachment } from '$lib/types';
  import { page } from '$app/stores';
  import { goto, onNavigate } from '$app/navigation';
  import { tick, onMount, onDestroy } from 'svelte';
  import { streamStates, endStream } from '$lib/streaming';
  import { browser } from '$app/environment';
  import { StreamingController } from '$lib/streaming';
  import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import Spinner from '$lib/components/common/Spinner.svelte';
  import { ArrowDown } from 'lucide-svelte';
  import { manifest } from '$lib';

  $: chatId = $page.params.chatId;
  $: activeChat = $chats.find((chat) => chat.id === chatId);
  $: currentStreamState = $streamStates[chatId];
  $: isLoading = currentStreamState?.isStreaming ?? false;
  $: currentlyStreamingMessageId = currentStreamState?.messageId ?? '';

  let userInput = '';
  let initialMessageProcessed = false;
  let autoScroll = true;
  let messagesContainerElement: HTMLDivElement;
  let showScrollButton = false;

  // Use web search options from the chat object, with fallback defaults
  $: webSearchEnabled = activeChat?.webSearchEnabled ?? false;
  $: webSearchContextSize = activeChat?.webSearchContextSize ?? 'low';

  // Map provides clearer semantics and easier cleanup than a plain object
  const streamControllers = new Map<string, StreamingController>();

  /**
   * Scrolls the messages container to the bottom
   */
  const scrollToBottom = () => {
    if (messagesContainerElement) {
      messagesContainerElement.scrollTop = messagesContainerElement.scrollHeight;
      autoScroll = true;

      // Focus the last message for accessibility
      const messageElements = messagesContainerElement.querySelectorAll('.message');
      const lastMessageElement = messageElements[messageElements.length - 1] as HTMLElement;
      if (lastMessageElement) lastMessageElement.focus();
      else messagesContainerElement.focus();
    }
  };

  /**
   * Updates autoScroll state based on current scroll position
   * AutoScroll is enabled when user is within 50px of the bottom
   */
  const handleScroll = () => {
    if (messagesContainerElement) {
      const element = messagesContainerElement;
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      autoScroll = distanceFromBottom <= 50;
      showScrollButton = distanceFromBottom > 256;
    }
  };

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
  async function handleSubmit(
    _: Event,
    attachments?: Attachment[],
    webSearchEnabled?: boolean,
    webSearchContextSize?: 'low' | 'medium' | 'high',
  ) {
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
      webSearchEnabled,
      webSearchContextSize,
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

    // Extract web search settings from the original assistant message
    const originalWebSearchEnabled = messageToRegenerate.webSearchEnabled || false;
    const originalWebSearchContextSize = messageToRegenerate.webSearchContextSize || 'low';

    // Truncate chat history to the point *before* the user message we are regenerating from.
    const truncatedMessages = activeChat.messages.slice(0, messageIndex - 1);

    let truncatedChat: typeof activeChat | null = null;
    chats.update((allChats) => {
      const chatIndex = allChats.findIndex((c) => c.id === chatId);
      if (chatIndex !== -1) {
        truncatedChat = {
          ...allChats[chatIndex],
          messages: truncatedMessages,
          updatedAt: new Date(),
        };
        allChats[chatIndex] = truncatedChat;
      }
      return allChats;
    });

    // Sync the thread after truncating messages for regeneration
    if (truncatedChat) {
      syncThread(truncatedChat);
    }

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
      originalWebSearchEnabled, // Use original web search settings
      originalWebSearchContextSize, // Use original web search context size
    );
  }

  /**
   * Handles editing a message and regenerating from that point
   */
  async function handleEdit(messageToEdit: Message, newContent: string, providerInstanceId: string, modelId: string) {
    if (!activeChat || isLoading) return;

    const messageIndex = activeChat.messages.findIndex((m) => m.id === messageToEdit.id);
    if (messageIndex === -1) {
      console.error('Message to edit not found.');
      return;
    }

    const wasLastMessage = messageIndex === activeChat.messages.length - 1;

    // Edit the message and truncate messages after it
    editMessage(chatId, messageToEdit.id, newContent);

    // Wait for Svelte to process the store update
    await tick();

    // If this was not the last message, regenerate from this point
    if (!wasLastMessage) {
      const controller = getOrCreateStreamController(chatId);
      const updatedChat = $chats.find((c) => c.id === chatId);
      if (!updatedChat) return;

      // Find the next assistant message to get its web search settings
      const nextAssistantMessage = activeChat.messages.slice(messageIndex + 1).find((m) => m.role === 'assistant');

      const originalWebSearchEnabled = nextAssistantMessage?.webSearchEnabled || false;
      const originalWebSearchContextSize = nextAssistantMessage?.webSearchContextSize || 'low';

      await controller.handleRegenerate(
        updatedChat,
        providerInstanceId,
        modelId,
        originalWebSearchEnabled, // Use original web search settings
        originalWebSearchContextSize, // Use original web search context size
      );
    }
  }

  /**
   * Handles branching off a conversation up to a specific message
   */
  function handleBranch(message: Message) {
    if (!activeChat) return;

    try {
      const newChatId = branchOffChat(chatId, message.id);
      // Navigate to the new branched chat
      goto(`/${newChatId}`);
    } catch (error) {
      console.error('Failed to branch off chat:', error);
    }
  }

  function handleWebSearchToggle(e: CustomEvent<{ enabled: boolean; contextSize: 'low' | 'medium' | 'high' }>) {
    if (!activeChat) return;

    let updatedChatSettings: typeof activeChat | null = null;
    // Update the chat object with new web search settings
    chats.update((allChats) =>
      allChats.map((chat) => {
        if (chat.id === chatId) {
          updatedChatSettings = {
            ...chat,
            webSearchEnabled: e.detail.enabled,
            webSearchContextSize: e.detail.contextSize,
            updatedAt: new Date(),
          };
          return updatedChatSettings;
        }
        return chat;
      }),
    );

    // Sync the thread after updating web search settings
    if (updatedChatSettings) {
      syncThread(updatedChatSettings);
    }
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

  // Auto-scroll when messages change and autoScroll is enabled
  $: if (activeChat?.messages && autoScroll) {
    tick().then(() => {
      scrollToBottom();
    });
  }

  // Auto-scroll when streaming state changes
  $: if (currentlyStreamingMessageId && autoScroll) {
    tick().then(() => {
      scrollToBottom();
    });
  }

  onNavigate(() => {
    if (browser && chatId && activeChat) {
      tick().then(() => {
        // Use setTimeout to allow markdown rendering and layout calculations to complete
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      });
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
          webSearchEnabled, // Pass the web search options
          webSearchContextSize, // Pass the web search context size
        );
      }
    }, 100);
  }
</script>

<svelte:head>
  <title>{activeChat ? `${activeChat.title} • ${manifest.name}` : manifest.name}</title>
</svelte:head>

<main class="chat relative flex h-full flex-1 flex-col">
  {#if activeChat}
    <div
      class="messages-container -mb-30 h-full overflow-y-auto"
      bind:this={messagesContainerElement}
      on:scroll={handleScroll}>
      <ChatMessages chat={activeChat} {currentlyStreamingMessageId} {handleRegenerate} {handleEdit} {handleBranch}
      ></ChatMessages>
    </div>

    <button
      class="button button-secondary button-circle button-rounded relative bottom-4 left-1/2 z-10 h-8 max-h-8 min-h-8 w-8 max-w-8 min-w-8 -translate-x-1/2 backdrop-blur-md transition-opacity"
      class:pointer-events-auto={showScrollButton}
      class:pointer-events-none={!showScrollButton}
      class:opacity-100={showScrollButton}
      class:opacity-0={!showScrollButton}
      on:click={scrollToBottom}
      title="Scroll to bottom"
      inert={!showScrollButton}>
      <ArrowDown size={20} />
    </button>

    <div class="input-container z-[1]">
      <ChatInput
        bind:userInput
        {webSearchEnabled}
        {webSearchContextSize}
        {isLoading}
        {handleSubmit}
        {handleStop}
        isTemporaryChat={activeChat.temporary || false}
        on:webSearchToggle={handleWebSearchToggle}>
      </ChatInput>
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
