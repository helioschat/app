<script lang="ts">
  import { onDestroy } from 'svelte';
  import { marked, type Token } from 'marked';
  import DOMPurify from 'dompurify';
  import hljs from 'highlight.js';
  import { Copy, Download, Check } from 'lucide-svelte';
  import { getLanguageExtension } from '$lib/utils/languageExtensions';

  export let content: string = '';
  export let isStreaming: boolean = false;
  export let messageDate: Date | undefined = undefined;

  let tokens: Token[] = [];
  let highlightCache = new Map<string, string>();
  let copiedStates = new Map<string, boolean>();

  // Configure marked for GFM support
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  // Tokenize markdown when content changes
  $: {
    if (content) {
      try {
        tokens = marked.lexer(content);
      } catch (error) {
        console.error('Markdown tokenization error:', error);
        tokens = [];
      }
    } else {
      tokens = [];
      highlightCache.clear();
    }
  }

  function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['span', 'strong', 'em', 'del', 'code', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
      ALLOW_DATA_ATTR: false,
    });
  }

  function renderInlineTokens(inlineTokens: Token[]): string {
    return inlineTokens
      .map((token) => {
        if (token.type === 'text') {
          return token.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else if (token.type === 'strong') {
          return `<strong>${renderInlineTokens(token.tokens || [])}</strong>`;
        } else if (token.type === 'em') {
          return `<em>${renderInlineTokens(token.tokens || [])}</em>`;
        } else if (token.type === 'del') {
          return `<del>${renderInlineTokens(token.tokens || [])}</del>`;
        } else if (token.type === 'codespan') {
          return `<code>${token.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
        } else if (token.type === 'link') {
          const href = token.href.replace(/"/g, '&quot;');
          const title = token.title ? ` title="${token.title.replace(/"/g, '&quot;')}"` : '';
          return `<a href="${href}"${title}>${renderInlineTokens(token.tokens || [])}</a>`;
        } else if (token.type === 'image') {
          const src = token.href.replace(/"/g, '&quot;');
          const alt = token.text.replace(/"/g, '&quot;');
          const title = token.title ? ` title="${token.title.replace(/"/g, '&quot;')}"` : '';
          return `<img src="${src}" alt="${alt}"${title} />`;
        } else if (token.type === 'br') {
          return '<br />';
        }
        return '';
      })
      .join('');
  }

  function headerComponent(depth: number): string {
    return 'h' + Math.min(Math.max(depth, 1), 6);
  }

  function highlightCode(code: string, lang: string, cacheKey: string): string {
    // Check cache first
    if (highlightCache.has(cacheKey)) {
      return highlightCache.get(cacheKey)!;
    }

    let result: string;
    if (lang && hljs.getLanguage(lang)) {
      try {
        result = hljs.highlight(code, { language: lang }).value;
        highlightCache.set(cacheKey, result);
        return result;
      } catch {
        // Fall through to auto-detect
      }
    }
    try {
      result = hljs.highlightAuto(code).value;
    } catch {
      result = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    highlightCache.set(cacheKey, result);
    return result;
  }

  onDestroy(() => {
    highlightCache.clear();
  });

  async function copyToClipboard(text: string, cacheKey: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedStates.set(cacheKey, true);
      copiedStates = copiedStates; // Trigger reactivity
      setTimeout(() => {
        copiedStates.delete(cacheKey);
        copiedStates = copiedStates;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 8);
  }

  async function downloadCode(code: string, lang: string) {
    const extension = getLanguageExtension(lang);
    const date = messageDate || new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const contentHash = await hashString(code);
    const filename = `code_${dateStr}_${contentHash}.${extension}`;

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="markdown-content" class:streaming={isStreaming}>
  {#each tokens as token, idx (idx)}
    {#if token.type === 'heading'}
      <svelte:element this={headerComponent(token.depth)}>
        {@html sanitizeHtml(renderInlineTokens(token.tokens || []))}
      </svelte:element>
    {:else if token.type === 'paragraph'}
      <p>{@html sanitizeHtml(renderInlineTokens(token.tokens || []))}</p>
    {:else if token.type === 'code'}
      {@const isLastToken = idx === tokens.length - 1}
      {@const shouldHighlight = !isStreaming || !isLastToken}
      {@const cacheKey = `${idx}-${token.lang || 'auto'}-${token.text.length}`}
      {@const displayLang = token.lang || 'text'}
      {@const isCopied = copiedStates.get(cacheKey) || false}
      <div class="code-block-container mb-2">
        <div
          class="code-block-header flex items-center justify-between rounded-t-2xl border-b border-[var(--color-6)] bg-[var(--color-4)] px-3 py-2">
          <span class="text-xs font-medium text-[var(--color-a12)] uppercase">{displayLang}</span>
          <div class="flex gap-0.5">
            <button
              class="button button-ghost code-action-btn"
              on:click={() => copyToClipboard(token.text, cacheKey)}
              title="Copy">
              {#if isCopied}
                <Check size={16} />
              {:else}
                <Copy size={16} />
              {/if}
            </button>
            <button
              class="button button-ghost code-action-btn"
              on:click={() => downloadCode(token.text, displayLang)}
              title="Download">
              <Download size={16} />
            </button>
          </div>
        </div>
        {#if shouldHighlight}
          <pre><code class="hljs {token.lang ? `language-${token.lang}` : ''}"
              >{@html highlightCode(token.text, token.lang || '', cacheKey)}</code></pre>
        {:else}
          <pre><code class="hljs {token.lang ? `language-${token.lang}` : ''}">{token.text}</code></pre>
        {/if}
      </div>
    {:else if token.type === 'blockquote'}
      <blockquote>
        <svelte:self content={token.text} isStreaming={false} />
      </blockquote>
    {:else if token.type === 'list'}
      {#if token.ordered}
        <ol start={token.start || 1}>
          {#each token.items as item}
            <li>
              {#if item.task}
                <input type="checkbox" checked={item.checked} disabled />
              {/if}
              <svelte:self content={item.text} isStreaming={false} />
            </li>
          {/each}
        </ol>
      {:else}
        <ul>
          {#each token.items as item}
            <li>
              {#if item.task}
                <input type="checkbox" checked={item.checked} disabled />
              {/if}
              <svelte:self content={item.text} isStreaming={false} />
            </li>
          {/each}
        </ul>
      {/if}
    {:else if token.type === 'table'}
      <table>
        <thead>
          <tr>
            {#each token.header as header}
              <th>{@html sanitizeHtml(renderInlineTokens(header.tokens || []))}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each token.rows as row}
            <tr>
              {#each row as cell}
                <td>{@html sanitizeHtml(renderInlineTokens(cell.tokens || []))}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if token.type === 'hr'}
      <hr />
    {:else if token.type === 'html'}
      {@html sanitizeHtml(token.text)}
    {:else if token.type === 'text'}
      {#if token.tokens}
        <p>{@html sanitizeHtml(renderInlineTokens(token.tokens))}</p>
      {:else}
        <p>{token.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      {/if}
    {:else if token.type === 'space'}
      <div class="space"></div>
    {/if}
  {/each}
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .markdown-content,
  .markdown-content :global(> *) {
    color: var(--color-12);
  }

  .markdown-content :global(> *:first-child) {
    @apply !mt-0;
  }

  .markdown-content :global(> *:last-child) {
    @apply !mb-0;
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4),
  .markdown-content :global(h5),
  .markdown-content :global(h6),
  .markdown-content :global(p),
  .markdown-content :global(ul),
  .markdown-content :global(ol),
  .markdown-content :global(blockquote),
  .markdown-content :global(pre),
  .markdown-content :global(hr),
  .markdown-content :global(table) {
    @apply mb-2;
  }

  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3),
  .markdown-content :global(h4),
  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    @apply font-semibold break-words;
    color: var(--color-12);
  }

  .markdown-content :global(h1) {
    @apply mt-3 text-2xl;
  }

  .markdown-content :global(h1:not(:last-child)) {
    @apply pb-1;
  }

  .markdown-content :global(h2) {
    @apply text-xl;
  }

  .markdown-content :global(h3) {
    @apply text-lg;
  }

  .markdown-content :global(p) {
    word-wrap: break-word;
  }

  .markdown-content :global(strong) {
    @apply font-bold;
  }

  .markdown-content :global(em) {
    @apply italic;
  }

  .markdown-content :global(del) {
    @apply line-through;
  }

  .markdown-content :global(a) {
    @apply text-blue-400 transition-colors hover:text-blue-300 active:text-blue-500;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    @apply pl-8;
  }

  .markdown-content :global(ul) {
    @apply list-disc;
  }

  .markdown-content :global(ol) {
    @apply list-decimal;
  }

  .markdown-content :global(blockquote) {
    @apply pl-8;
  }

  .code-action-btn {
    @apply rounded-lg p-0.5 transition-colors;
  }

  .code-block-container :global(pre) {
    @apply !mt-0 !mb-0 !rounded-t-none;
  }

  .markdown-content :global(pre),
  .markdown-content :global(p > code) {
    background: var(--color-3);
    @apply text-sm;
  }

  .markdown-content :global(pre) {
    @apply overflow-auto rounded-2xl p-3;
  }

  .markdown-content :global(p > code) {
    @apply rounded-lg;
    @apply px-1.5 py-0.5;
    @apply whitespace-break-spaces;
  }

  .markdown-content :global(table) {
    @apply block w-max max-w-full border-collapse overflow-auto tabular-nums;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    @apply px-3 py-1.5;
    @apply border;
    border-color: var(--color-6);
  }

  .markdown-content :global(tr:nth-child(2n)) {
    background: var(--color-3);
  }

  .markdown-content :global(hr) {
    border-color: var(--color-6);
  }

  .markdown-content :global(section.footnotes) {
    @apply pt-4;
    @apply border-t;
    border-color: var(--color-6);
    @apply text-xs;
    color: var(--color-11);
  }

  /* Style for streaming content - optional animation */
  .streaming :global(p:last-child)::after {
    content: '▋';
    display: inline-block;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
</style>
