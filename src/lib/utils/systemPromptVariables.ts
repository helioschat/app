/**
 * System prompt variable substitution.
 *
 * Supported variables (case-insensitive, prefix with `$`):
 *
 *   $current_datetime     — Full locale date + time, e.g. "Monday, March 2, 2026, 14:05:32"
 *   $user_timezone        — IANA timezone identifier, e.g. "Europe/Budapest"
 *   $user_locale          — Browser locale string, e.g. "en-US"
 *   $user_language        — ISO language tag, e.g. "en"
 *   $user_platform        — Operating system / platform, e.g. "Linux x86_64"
 */

export interface SystemPromptVariable {
  /** Variable name without the `$` prefix (lowercase). */
  name: string;
  /** Short human-readable description shown in the settings UI. */
  description: string;
  /** Resolve the current value of this variable. */
  resolve: () => string;
}

function zeroPad(n: number): string {
  return n.toString().padStart(2, '0');
}

export const SYSTEM_PROMPT_VARIABLES: SystemPromptVariable[] = [
  {
    name: 'current_datetime',
    description: 'Current local date and time (e.g. Monday, March 2, 2026, 14:05:32)',
    resolve: () => {
      const now = new Date();
      return now.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    },
  },
  {
    name: 'user_timezone',
    description: 'Local IANA timezone (e.g. Europe/Budapest)',
    resolve: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  {
    name: 'user_locale',
    description: 'Browser locale string (e.g. en-US)',
    resolve: () => Intl.DateTimeFormat().resolvedOptions().locale ?? navigator.language ?? 'unknown',
  },
  {
    name: 'user_language',
    description: 'ISO language tag (e.g. en)',
    resolve: () => (navigator.language ?? 'unknown').split('-')[0],
  },
  {
    name: 'user_platform',
    description: 'Operating system / platform (e.g. Linux x86_64)',
    resolve: () => {
      // navigator.userAgentData is a newer API not available everywhere
      const nav = navigator as Navigator & {
        userAgentData?: { platform?: string };
      };
      return nav.userAgentData?.platform ?? navigator.platform ?? 'unknown';
    },
  },
];

/**
 * Build a lookup map from lowercase variable name → resolver function.
 */
const VARIABLE_MAP = new Map<string, () => string>(
  SYSTEM_PROMPT_VARIABLES.map((v) => [v.name.toLowerCase(), v.resolve]),
);

/**
 * Replace all `$variable_name` tokens in `prompt` with their resolved values.
 * Matching is case-insensitive. Unknown variables are left untouched.
 */
export function resolveSystemPromptVariables(prompt: string): string {
  // Match $identifier tokens (letters, digits, underscores after the $).
  return prompt.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name: string) => {
    const resolver = VARIABLE_MAP.get(name.toLowerCase());
    return resolver ? resolver() : _match;
  });
}
