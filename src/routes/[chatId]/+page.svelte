<script lang="ts">
  import { chats, loadChat, clearTemporaryChats, editMessage, branchOffChat } from '$lib/stores/chat';
  import { selectedModel, advancedSettings } from '$lib/settings/SettingsManager';
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

  // Message being edited — null when not in edit mode
  let editingMessage: Message | null = null;
  let editInput = '';

  // Modifier state — initialized from the chat object when the chat changes,
  // but kept as local state so they don't get overwritten on every streaming token.
  let webSearchEnabled = false;
  let webSearchContextSize: 'low' | 'medium' | 'high' = 'low';
  let reasoningEnabled = false;
  let reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'medium';
  let reasoningSummary: 'auto' | 'concise' | 'detailed' = 'auto';

  // Track which chat ID we last synced modifiers from so we only re-read the
  // persisted settings when the user actually switches to a different chat.
  let modifierSyncedChatId = '';

  $: if (activeChat && activeChat.id !== modifierSyncedChatId) {
    modifierSyncedChatId = activeChat.id;
    webSearchEnabled = activeChat.webSearchEnabled ?? false;
    webSearchContextSize = activeChat.webSearchContextSize ?? 'low';
    reasoningEnabled = activeChat.reasoningEnabled ?? false;
    reasoningEffort = activeChat.reasoningEffort ?? 'medium';
    reasoningSummary = activeChat.reasoningSummary ?? 'auto';
  }

  // Map provides clearer semantics and easier cleanup than a plain object
  const streamControllers = new Map<string, StreamingController>();

  /**
   * Scrolls the messages container to the bottom
   */
  const scrollToBottom = () => {
    if (messagesContainerElement) {
      messagesContainerElement.scrollTop = messagesContainerElement.scrollHeight;
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
    reasoningEnabled?: boolean,
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high',
    reasoningSummary?: 'auto' | 'concise' | 'detailed',
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
      reasoningEnabled,
      reasoningEffort,
      reasoningSummary,
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

    // Extract reasoning settings from the original assistant message
    const originalReasoningEnabled = messageToRegenerate.reasoningEnabled || false;
    const originalReasoningEffort = messageToRegenerate.reasoningEffort || 'medium';
    const originalReasoningSummary = messageToRegenerate.reasoningSummary || 'auto';

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
      originalReasoningEnabled, // Use original reasoning settings
      originalReasoningEffort, // Use original reasoning effort
      originalReasoningSummary, // Use original reasoning summary
    );
  }

  /**
   * Called when the user clicks Edit on a message — opens the edit ChatInput.
   */
  function handleStartEdit(messageToEdit: Message) {
    if (isLoading) return;
    editingMessage = messageToEdit;
    editInput = messageToEdit.content;
  }

  /**
   * Called when the user cancels editing.
   */
  function handleCancelEdit() {
    editingMessage = null;
    editInput = '';
  }

  /**
   * Called when the user submits the edited message via the ChatInput.
   */
  async function handleEditSubmit(
    _: Event,
    _attachments?: Attachment[],
    editWebSearchEnabled?: boolean,
    editWebSearchContextSize?: 'low' | 'medium' | 'high',
    editReasoningEnabled?: boolean,
    editReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high',
    editReasoningSummary?: 'auto' | 'concise' | 'detailed',
  ) {
    if (!editingMessage || !activeChat || isLoading || !editInput.trim()) return;

    const messageToEdit = editingMessage;
    const newContent = editInput.trim();

    // Clear edit mode immediately
    editingMessage = null;
    editInput = '';

    const messageIndex = activeChat.messages.findIndex((m) => m.id === messageToEdit.id);
    if (messageIndex === -1) {
      console.error('Message to edit not found.');
      return;
    }

    const wasLastMessage = messageIndex === activeChat.messages.length - 1;

    // Assistant message edits are in-place — the full conversation history is
    // preserved and the updated content will be included in the context on the
    // next model call. No truncation or regeneration occurs.
    if (messageToEdit.role === 'assistant') {
      editMessage(chatId, messageToEdit.id, newContent, false);
      return;
    }

    // Snapshot messages after the edited message before the store is mutated
    const messagesAfter = activeChat.messages.slice(messageIndex + 1);

    // Edit the message and truncate messages after it
    editMessage(chatId, messageToEdit.id, newContent);

    // Wait for Svelte to process the store update
    await tick();

    // If this was not the last message, regenerate from this point so the model
    // sees the updated history (applies to both user and assistant message edits)
    if (!wasLastMessage) {
      const controller = getOrCreateStreamController(chatId);
      let updatedChat = $chats.find((c) => c.id === chatId);
      if (!updatedChat || !$selectedModel) return;

      // Find the next assistant message to inherit its original generation settings
      const nextAssistantMessage = messagesAfter.find((m) => m.role === 'assistant');

      const originalWebSearchEnabled = editWebSearchEnabled ?? nextAssistantMessage?.webSearchEnabled ?? false;
      const originalWebSearchContextSize =
        editWebSearchContextSize ?? nextAssistantMessage?.webSearchContextSize ?? 'low';
      const originalReasoningEnabled = editReasoningEnabled ?? nextAssistantMessage?.reasoningEnabled ?? false;
      const originalReasoningEffort = editReasoningEffort ?? nextAssistantMessage?.reasoningEffort ?? 'medium';
      const originalReasoningSummary = editReasoningSummary ?? nextAssistantMessage?.reasoningSummary ?? 'auto';

      await controller.handleRegenerate(
        updatedChat,
        $selectedModel.providerInstanceId,
        $selectedModel.modelId,
        originalWebSearchEnabled,
        originalWebSearchContextSize,
        originalReasoningEnabled,
        originalReasoningEffort,
        originalReasoningSummary,
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

    // Update local state immediately so the UI reflects the change
    webSearchEnabled = e.detail.enabled;
    webSearchContextSize = e.detail.contextSize;

    let updatedChatSettings: typeof activeChat | null = null;
    // Persist to the chat object so settings survive reloads
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
  }

  function handleReasoningToggle(
    e: CustomEvent<{
      enabled: boolean;
      effort: 'minimal' | 'low' | 'medium' | 'high';
      summary: 'auto' | 'concise' | 'detailed';
    }>,
  ) {
    if (!activeChat) return;

    // Update local state immediately so the UI reflects the change
    reasoningEnabled = e.detail.enabled;
    reasoningEffort = e.detail.effort;
    reasoningSummary = e.detail.summary;

    let updatedChatSettings: typeof activeChat | null = null;
    // Persist to the chat object so settings survive reloads
    chats.update((allChats) =>
      allChats.map((chat) => {
        if (chat.id === chatId) {
          updatedChatSettings = {
            ...chat,
            reasoningEnabled: e.detail.enabled,
            reasoningEffort: e.detail.effort,
            reasoningSummary: e.detail.summary,
            updatedAt: new Date(),
          };
          return updatedChatSettings;
        }
        return chat;
      }),
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
          autoScroll = true;
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
          reasoningEnabled, // Pass the reasoning options
          reasoningEffort, // Pass the reasoning effort
          reasoningSummary, // Pass the reasoning summary
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
      <ChatMessages
        chat={activeChat}
        editingMessageId={editingMessage?.id ?? ''}
        allowAssistantEditing={$advancedSettings.allowAssistantMessageEditing}
        {handleRegenerate}
        {handleStartEdit}
        {handleCancelEdit}
        {handleBranch}></ChatMessages>
    </div>

    <button
      class="button button-secondary button-circle button-rounded relative bottom-4 left-1/2 z-10 h-8 max-h-8 min-h-8 w-8 max-w-8 min-w-8 -translate-x-1/2 backdrop-blur-md transition-opacity"
      class:pointer-events-auto={showScrollButton}
      class:pointer-events-none={!showScrollButton}
      class:opacity-100={showScrollButton}
      class:opacity-0={!showScrollButton}
      on:click={() => {
        autoScroll = true;
        scrollToBottom();
      }}
      title="Scroll to bottom"
      inert={!showScrollButton}>
      <ArrowDown size={20} />
    </button>

    <div class="input-container z-[1]">
      {#if editingMessage}
        <div class="edit-banner mx-auto -mb-6 w-full max-w-4xl px-4">
          <div
            class="flex w-full items-center justify-between gap-2 rounded-t-[28px] bg-[var(--color-2)] px-4 pt-2 pb-8 shadow">
            <div class="flex items-center gap-1.5">
              <span class="edit-dot inline-block h-1.5 w-1.5 rounded-full"></span>
              <span class="text-xs font-medium">Editing message</span>
            </div>
            <button
              class="button button-ghost button-small button-circle text-xs"
              data-cancel-edit-btn
              on:click={handleCancelEdit}
              title="Cancel edit (Escape)">
              Cancel
            </button>
          </div>
        </div>
        <ChatInput
          bind:userInput={editInput}
          isLoading={false}
          handleSubmit={handleEditSubmit}
          {handleStop}
          {webSearchEnabled}
          {webSearchContextSize}
          {reasoningEnabled}
          {reasoningEffort}
          {reasoningSummary}
          isTemporaryChat={activeChat.temporary || false}
          on:webSearchToggle={handleWebSearchToggle}
          on:reasoningToggle={handleReasoningToggle}></ChatInput>
      {:else}
        <ChatInput
          bind:userInput
          {webSearchEnabled}
          {webSearchContextSize}
          {reasoningEnabled}
          {reasoningEffort}
          {reasoningSummary}
          {isLoading}
          {handleSubmit}
          {handleStop}
          isTemporaryChat={activeChat.temporary || false}
          on:webSearchToggle={handleWebSearchToggle}
          on:reasoningToggle={handleReasoningToggle}>
        </ChatInput>
      {/if}
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
  @reference "tailwindcss";

  .input-container {
    background-image: linear-gradient(to top, var(--color-1), transparent);
    background-size: 100% 120px;
    background-repeat: no-repeat;
  }

  .edit-dot {
    background-color: var(--red-9);
    animation: edit-pulse 2s ease-in-out infinite;
  }

  @keyframes edit-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
