<script lang="ts">
  import type { Attachment } from '$lib/types';
  import { formatFileSize } from '$lib/utils/attachments';
  import { File, Download, X, Expand } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import ImageLightbox from '$lib/components/chat/ImageLightbox.svelte';

  // List of attachments to display
  export let attachments: Attachment[];

  // When true, show a close button allowing the caller to remove attachments
  export let canRemove: boolean = false;

  // Indicates message already sent; toggles UI differences (download vs remove, thumbnail size)
  export let isSent: boolean = false;

  // When true the message contains only images (no text / other content)
  export let imageOnly: boolean = false;

  const dispatch = createEventDispatcher<{ remove: { id: string } }>();

  let lightboxAttachment: Attachment | null = null;

  function openLightbox(attachment: Attachment) {
    lightboxAttachment = attachment;
  }

  function closeLightbox() {
    lightboxAttachment = null;
  }

  function emitRemove(id: string) {
    dispatch('remove', { id });
  }

  function downloadAttachment(attachment: Attachment) {
    try {
      // Create a blob from base64 data
      const byteCharacters = atob(attachment.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.mimeType });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  }
</script>

{#snippet downloadBtn(attachment: Attachment)}
  <button
    type="button"
    class="button button-small button-secondary"
    onclick={() => downloadAttachment(attachment)}
    title="Download {attachment.name}">
    <Download size={14} />
  </button>
{/snippet}

{#snippet removeBtn(attachment: Attachment)}
  <button
    type="button"
    class="button button-small button-secondary"
    onclick={() => emitRemove(attachment.id)}
    aria-label="Remove attachment">
    <X size={12} />
  </button>
{/snippet}

{#if attachments && attachments.length > 0}
  <div class="flex flex-wrap gap-2" class:image-only-grid={imageOnly && isSent}>
    {#each attachments as attachment (attachment.id)}
      <div
        class="attachment relative flex h-fit w-full max-w-full items-center gap-3 rounded-lg border border-[var(--color-6)] bg-[var(--color-3)] p-3 sm:w-fit sm:max-w-48 md:max-w-64 lg:max-w-96"
        class:file={attachment.type === 'file'}
        class:image={attachment.type === 'image' && attachment.previewUrl}
        class:sent={isSent}
        class:image-only={imageOnly && isSent}>
        <div class="peer flex w-full items-center">
          {#if attachment.type === 'image' && attachment.previewUrl}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
            <img
              class={isSent ? 'max-h-64 rounded' : 'h-12 w-12 rounded object-cover'}
              class:clickable={isSent}
              src={attachment.previewUrl}
              alt={attachment.name}
              onclick={isSent ? () => openLightbox(attachment) : undefined} />
          {:else}
            <div
              class="flex h-12 w-12 items-center justify-center rounded bg-[var(--color-a5)] text-[var(--color-a11)]">
              <File size={24} />
            </div>
          {/if}
          {#if !(isSent && attachment.type === 'image' && attachment.previewUrl)}
            <div class="ml-3 min-w-0 flex-1 text-left">
              <p class="truncate text-sm font-medium">{attachment.name}</p>
              <p class="text-secondary text-xs">{formatFileSize(attachment.size)}</p>
            </div>
            {#if isSent && (attachment.type !== 'image' || (attachment.type === 'image' && !attachment.previewUrl))}
              <div class="ml-1">
                {@render downloadBtn(attachment)}
              </div>
            {/if}
            {#if canRemove && !isSent}
              <div class="ml-1">
                {@render removeBtn(attachment)}
              </div>
            {/if}
          {/if}
        </div>
        {#if isSent && attachment.type === 'image' && attachment.previewUrl}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="pointer-events-none absolute top-0 left-0 flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded bg-black/50 opacity-0 transition-opacity peer-hover:pointer-events-auto peer-hover:opacity-100 hover:pointer-events-auto hover:opacity-100"
            onclick={() => openLightbox(attachment)}>
            <div onclick={(e) => e.stopPropagation()}>
              {@render downloadBtn(attachment)}
            </div>
            <button
              type="button"
              class="button button-small button-secondary"
              onclick={(e) => {
                e.stopPropagation();
                openLightbox(attachment);
              }}
              title="View full size">
              <Expand size={14} />
            </button>
            <div class="pointer-events-none absolute right-0 bottom-0">
              <p class="text-secondary p-2 text-xs select-none">{formatFileSize(attachment.size)}</p>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

{#if lightboxAttachment}
  <ImageLightbox attachment={lightboxAttachment} isOpen={true} onclose={closeLightbox} />
{/if}

<style lang="postcss">
  @reference "tailwindcss";

  .attachment.sent.image {
    @apply rounded-none border-none bg-transparent p-0;
  }

  .attachment.sent.image.image-only {
    @apply overflow-hidden rounded-lg;
  }

  img.clickable {
    @apply cursor-pointer transition-opacity hover:opacity-90;
  }

  .image-only-grid {
    @apply gap-1.5;
  }
</style>
