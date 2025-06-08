<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { markedHighlight } from 'marked-highlight';
  import { getHighlighter } from 'shiki-es';

  export let content: string = '';
  export let isStreaming: boolean = false;

  let renderedHtml = '';
  let highlighter: any;

  async function initializeRenderer() {
    highlighter = await getHighlighter({
      themes: ['github-dark'],
      langs: ['javascript', 'typescript', 'html', 'css', 'json', 'python', 'bash', 'markdown'],
    });

    marked.use(
      markedHighlight({
        async: true,
        highlight(code, language) {
          try {
            if (!language || language === 'plaintext') {
              return `<pre><code>${code}</code></pre>`;
            }

            const supportedLang = highlighter.getLoadedLanguages().includes(language) ? language : 'plaintext';

            return highlighter.codeToHtml(code, {
              lang: supportedLang,
              theme: 'github-dark',
            });
          } catch (error) {
            console.error('Highlighting error:', error);
            return `<pre><code>${code}</code></pre>`;
          }
        },
      }),
    );

    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert line breaks to <br>
      async: true,
    });

    renderMarkdown();
  }

  async function renderMarkdown() {
    if (!content) {
      renderedHtml = '';
      return;
    }

    try {
      renderedHtml = await marked.parse(content, { async: true });
    } catch (error) {
      console.error('Markdown rendering error:', error);
      renderedHtml = `<p>${content}</p>`;
    }
  }

  // Re-render when content changes
  $: if (highlighter && content) {
    renderMarkdown();
  }

  onMount(() => {
    initializeRenderer();

    return () => {
      highlighter = null;
    };
  });
</script>

<div class="markdown-content" class:streaming={isStreaming}>
  {#if renderedHtml}
    {@html renderedHtml}
  {:else}
    <p>{content}</p>
  {/if}
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

  .markdown-content :global(pre),
  .markdown-content :global(p > code) {
    background: var(--color-2);
    @apply text-sm;
  }

  .markdown-content :global(pre) {
    @apply overflow-auto rounded-2xl p-4;
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
