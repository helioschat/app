import { browser } from '$app/environment';

export enum ShortcutCategory {
  Generic = 'Generic',
  Navigation = 'Navigation',
  ChatActions = 'Chat',
  Settings = 'Settings',
}

export interface ShortcutConfig {
  key: string;
  displayKey?: string; // Optional custom display key (e.g., for special keys)
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  action: () => void;
  description: string;
  category: ShortcutCategory;
  requiresSetup?: boolean; // If true, only works after setup is complete
  allowInInput?: boolean; // If true, shortcut works even when focus is on an input element
}

export type ShortcutRegistry = Record<string, ShortcutConfig>;

/**
 * Check if the current platform is macOS
 */
export function isMac(): boolean {
  if (!browser) return false;
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

/**
 * Create a unique key for a shortcut based on modifiers and key
 */
export function getShortcutKey(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');

  parts.push(event.key.toLowerCase());

  return parts.join('+');
}

/**
 * Check if a keyboard event matches a shortcut config
 */
export function matchesShortcut(event: KeyboardEvent, config: ShortcutConfig): boolean {
  if (event.key.toLowerCase() !== config.key.toLowerCase()) return false;

  const mac = isMac();

  // On Mac, Cmd is the primary modifier (meta), on others it's Ctrl
  const primaryModifier = mac ? config.modifiers.meta : config.modifiers.ctrl;
  const eventPrimaryModifier = mac ? event.metaKey : event.ctrlKey;

  if (!!primaryModifier !== eventPrimaryModifier) return false;
  if (!!config.modifiers.shift !== event.shiftKey) return false;
  if (!!config.modifiers.alt !== event.altKey) return false;

  // On Mac, ignore ctrl when meta is the primary modifier
  // On other platforms, ignore meta
  if (mac && config.modifiers.meta) {
    return true;
  }

  return true;
}

/**
 * Group shortcuts by category
 */
export function groupShortcuts(shortcuts: ShortcutRegistry): Array<{
  category: ShortcutCategory;
  shortcuts: Array<[string, ShortcutConfig]>;
}> {
  const groups = new Map<ShortcutCategory, Array<[string, ShortcutConfig]>>();

  for (const [key, config] of Object.entries(shortcuts)) {
    if (config.category === ShortcutCategory.Generic) continue;

    if (!groups.has(config.category)) {
      groups.set(config.category, []);
    }
    groups.get(config.category)!.push([key, config]);
  }

  return Array.from(groups.entries()).map(([category, shortcuts]) => ({
    category,
    shortcuts,
  }));
}

/**
 * Format shortcut for display
 */
export function formatShortcut(config: ShortcutConfig): string {
  const parts: string[] = [];
  const mac = isMac();

  if (config.modifiers.ctrl && !mac) parts.push('Ctrl');
  if (config.modifiers.meta && mac) parts.push('⌘');
  if (config.modifiers.alt) parts.push(mac ? '⌥' : 'Alt');
  if (config.modifiers.shift) parts.push(mac ? '⇧' : 'Shift');

  parts.push(config.displayKey ? config.displayKey : config.key.toUpperCase());

  return parts.join(mac ? '' : '+');
}
