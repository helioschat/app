<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import type { ShortcutRegistry } from '$lib/stores/shortcuts';
  import { matchesShortcut, ShortcutCategory } from '$lib/stores/shortcuts';
  import { deleteChatById } from '$lib/stores/chat';
  import ShortcutsModal from '$lib/components/modal/types/ShortcutsModal.svelte';
  import ConfirmationModal from '$lib/components/modal/types/ConfirmationModal.svelte';

  interface Props {
    isSetupComplete: boolean;
  }

  let { isSetupComplete }: Props = $props();

  let showShortcutsModal = $state(false);
  let showDeleteConfirmation = $state(false);
  let chatToDelete = $state<string | null>(null);

  /**
   * Navigate between messages in the chat
   * @param direction - 'previous' for up arrow, 'next' for down arrow
   */
  function navigateMessage(direction: 'previous' | 'next') {
    const messages = Array.from(document.querySelectorAll<HTMLElement>('.message'));
    if (messages.length === 0) return;

    const activeElement = document.activeElement as HTMLElement;
    const currentMessage = activeElement?.closest('.message') as HTMLElement;

    if (!currentMessage) {
      // Focus the last message for previous, first message for next
      const targetMessage = direction === 'previous' ? messages[messages.length - 1] : messages[0];
      targetMessage?.focus();
    } else {
      const currentIndex = messages.indexOf(currentMessage);
      const nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex >= 0 && nextIndex < messages.length) {
        messages[nextIndex]?.focus();
      }
    }
  }

  /**
   * Registry of all available shortcuts in the application
   * Add new shortcuts here for easy management
   */
  const shortcuts: ShortcutRegistry = {
    dismiss: {
      key: 'Escape',
      modifiers: {},
      description: 'Dismiss modals / popups',
      category: ShortcutCategory.Generic,
      requiresSetup: false,
      allowInInput: true,
      action: () => {
        // Try to find any open modals or popups and close them
        const openModals = document.querySelectorAll<HTMLElement>('[data-modal]');
        if (openModals.length === 0) return;

        const openModal = openModals[openModals.length - 1];
        const button = openModal.querySelector<HTMLButtonElement>('.modal-close-btn');

        if (button) {
          button.click();
        }
      },
    },
    confirm: {
      key: 'Enter',
      modifiers: {},
      description: 'Confirm action in modals / popups',
      category: ShortcutCategory.Generic,
      requiresSetup: false,
      allowInInput: true,
      action: () => {
        // Try to find any open confirmation modals and confirm them
        const openModals = document.querySelectorAll<HTMLElement>('[data-modal]');
        if (openModals.length === 0) return;

        const openModal = openModals[openModals.length - 1];
        const button = openModal.querySelector<HTMLButtonElement>('.modal-confirm-btn');

        if (button) {
          button.click();
        }
      },
    },
    newChat: {
      key: 'o',
      modifiers: { ctrl: true, shift: true, meta: true },
      description: 'Open new chat',
      category: ShortcutCategory.Navigation,
      requiresSetup: true,
      allowInInput: true,
      action: () => {
        goto('/');
      },
    },
    addAttachment: {
      key: 'u',
      modifiers: { ctrl: true, meta: true },
      description: 'Add photos & files',
      category: ShortcutCategory.ChatActions,
      requiresSetup: true,
      allowInInput: true,
      action: () => {
        // Try to find the attachment button element
        const button = document.querySelector<HTMLButtonElement>('#chat-attach-button');

        if (button) {
          button.click();
        }
      },
    },
    focusChatInput: {
      key: 'Escape',
      displayKey: 'Esc',
      modifiers: { shift: true },
      description: 'Focus chat input',
      category: ShortcutCategory.ChatActions,
      requiresSetup: true,
      allowInInput: false,
      action: () => {
        // Try to find the chat input element
        const input = document.querySelector<HTMLTextAreaElement>('#chat-input-textarea');

        if (input) {
          input.focus();
          // Move cursor to end of input
          setTimeout(() => {
            input.setSelectionRange(input.value.length, input.value.length);
          }, 0);
        }
      },
    },
    focusSearch: {
      key: 'k',
      modifiers: { ctrl: true, meta: true },
      description: 'Search chats',
      category: ShortcutCategory.Navigation,
      requiresSetup: true,
      allowInInput: true,
      action: () => {
        // Try to find the search input element
        const input = document.querySelector<HTMLInputElement>('#chat-search-input');

        if (input) {
          input.focus();
          // Prevent the 'k' from being typed into the input
          setTimeout(() => {
            input.setSelectionRange(input.value.length, input.value.length);
          }, 0);
        }
      },
    },
    toggleSidebar: {
      key: 'b',
      modifiers: { ctrl: true, meta: true },
      description: 'Toggle sidebar',
      category: ShortcutCategory.Navigation,
      requiresSetup: true,
      allowInInput: true,
      action: () => {
        // Try to find the sidebar toggle button
        const button = document.querySelector<HTMLButtonElement>('#toggle-sidebar-button');

        if (button) {
          button.click();
        }
      },
    },
    deleteChat: {
      key: 'Backspace',
      displayKey: '⌫',
      modifiers: { ctrl: true, shift: true, meta: true },
      description: 'Delete current chat',
      category: ShortcutCategory.ChatActions,
      requiresSetup: true,
      allowInInput: true,
      action: () => {
        const currentChatId = $page.params.chatId;
        if (currentChatId) {
          chatToDelete = currentChatId;
          showDeleteConfirmation = true;
        }
      },
    },
    showShortcuts: {
      key: '/',
      modifiers: { ctrl: true, meta: true },
      description: 'Show keyboard shortcuts',
      category: ShortcutCategory.Settings,
      requiresSetup: false,
      allowInInput: true,
      action: () => {
        showShortcutsModal = true;
      },
    },
    previousMessage: {
      key: 'ArrowUp',
      displayKey: '↑',
      modifiers: { ctrl: true, meta: true },
      description: 'Focus previous message',
      category: ShortcutCategory.ChatActions,
      requiresSetup: true,
      allowInInput: false,
      action: () => navigateMessage('previous'),
    },
    nextMessage: {
      key: 'ArrowDown',
      displayKey: '↓',
      modifiers: { ctrl: true, meta: true },
      description: 'Focus next message',
      category: ShortcutCategory.ChatActions,
      requiresSetup: true,
      allowInInput: false,
      action: () => navigateMessage('next'),
    },
    copyLastCodeBlock: {
      key: ':',
      displayKey: ';',
      modifiers: { ctrl: true, shift: true, meta: true },
      description: 'Copy last code block',
      category: ShortcutCategory.ChatActions,
      requiresSetup: true,
      allowInInput: true,
      action: async () => {
        // Try to find the last code block in the chat messages
        const buttons = document.querySelectorAll('.code-copy-action-btn') as NodeListOf<HTMLButtonElement>;
        if (buttons.length === 0) return;

        const button = buttons[buttons.length - 1];

        if (button) {
          button.click();
        }
      },
    },
  };

  async function handleConfirmDelete() {
    if (chatToDelete) {
      await deleteChatById(chatToDelete);
      if (chatToDelete === $page.params.chatId) {
        goto('/');
      }
      chatToDelete = null;
    }
    showDeleteConfirmation = false;
  }

  function handleCancelDelete() {
    chatToDelete = null;
    showDeleteConfirmation = false;
  }

  /**
   * Handle keyboard events and match against registered shortcuts
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (!browser) return;

    // Don't trigger shortcuts when user is typing in an input, textarea, or contenteditable
    const target = event.target as HTMLElement;
    const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Check each shortcut
    for (const config of Object.values(shortcuts)) {
      // Skip shortcuts that require setup if setup is not complete
      if (config.requiresSetup && !isSetupComplete) {
        continue;
      }

      // Skip shortcuts that don't allow input if user is in an input element
      if (isInputElement && !config.allowInInput) {
        continue;
      }

      if (matchesShortcut(event, config)) {
        event.preventDefault();
        event.stopPropagation();
        config.action();
        break;
      }
    }
  }

  onMount(() => {
    if (browser) {
      window.addEventListener('keydown', handleKeyDown);
    }
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });
</script>

<ShortcutsModal
  id="shortcuts-modal"
  isOpen={showShortcutsModal}
  {shortcuts}
  on:close={() => (showShortcutsModal = false)} />

<ConfirmationModal
  id="delete-chat-shortcut-modal"
  title="Delete Chat"
  message="Are you sure you want to delete this chat? This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  isDangerous={true}
  isOpen={showDeleteConfirmation}
  on:confirm={handleConfirmDelete}
  on:cancel={handleCancelDelete} />
