<script lang="ts">
  import { onMount } from 'svelte';
  import rehypeHighlight from 'rehype-highlight';
  import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
  import rehypeStringify from 'rehype-stringify';
  import remarkFrontmatter from 'remark-frontmatter';
  import remarkGemoji from 'remark-gemoji';
  import remarkGfm from 'remark-gfm';
  import remarkParse from 'remark-parse';
  import remarkRehype from 'remark-rehype';
  import { unified } from 'unified';

  export let content: string = '';
  export let isStreaming: boolean = false;

  let renderedHtml = '';
  let processor: ReturnType<typeof createMarkdownProcessor> | null = null;

  const baseSanitizationSchema = {
    ...defaultSchema,
  };

  function createMarkdownProcessor() {
    return unified()
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .use(remarkGemoji)
      .use(remarkRehype)
      .use(rehypeSanitize, {
        ...baseSanitizationSchema,
        attributes: {
          ...baseSanitizationSchema.attributes,
          '*': ['class'],
        },
      })
      .use(rehypeHighlight)
      .use(rehypeStringify);
  }

  async function renderMarkdown() {
    if (!content || !processor) {
      renderedHtml = '';
      return;
    }

    try {
      const result = await processor.process(content);
      renderedHtml = String(result);
    } catch (error) {
      console.error('Markdown rendering error:', error);
      renderedHtml = `<p>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
  }

  // Re-render when content changes
  $: if (processor && content) {
    renderMarkdown();
  }

  onMount(() => {
    processor = createMarkdownProcessor();
    renderMarkdown();

    return () => {
      processor = null;
    };
  });
</script>

<div class="markdown-content" class:streaming={isStreaming}>
  {#if renderedHtml}
    {@html renderedHtml}
  {:else}
    <p>{content.trim()}</p>
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
