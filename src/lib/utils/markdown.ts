/**
 * Extract code blocks from content
 * Useful for optimizing syntax highlighting by pre-loading languages
 */
export function extractCodeLanguages(content: string): string[] {
  if (!content) return [];

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n/g;
  const languages = new Set<string>();
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match[1] && match[1].trim() !== '') {
      languages.add(match[1].toLowerCase().trim());
    }
  }

  return Array.from(languages);
}

/**
 * Safe HTML escaping for non-markdown content
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
