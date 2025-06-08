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

<style>
  .markdown-content {
    width: 100%;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
  }

  .markdown-content :global(pre) {
    margin: 1em 0;
    padding: 1em;
    border-radius: 0.3em;
    background: #1e1e1e;
    overflow-x: auto;
  }

  .markdown-content :global(code) {
    font-family: monospace;
    font-size: 0.9em;
  }

  .markdown-content :global(p) {
    margin: 0.5em 0;
  }

  .markdown-content :global(h1) {
    font-size: 1.8em;
    margin: 0.67em 0;
  }

  .markdown-content :global(h2) {
    font-size: 1.5em;
    margin: 0.75em 0;
  }

  .markdown-content :global(h3) {
    font-size: 1.3em;
    margin: 0.83em 0;
  }

  .markdown-content :global(h4) {
    font-size: 1.1em;
    margin: 1.12em 0;
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin: 1em 0;
    padding-left: 2em;
  }

  .markdown-content :global(table) {
    border-collapse: collapse;
    margin: 1em 0;
    width: 100%;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    border: 1px solid #ddd;
    padding: 6px 13px;
  }

  .markdown-content :global(blockquote) {
    margin: 1em 0;
    padding-left: 1em;
    border-left: 4px solid #ddd;
    color: #777;
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
