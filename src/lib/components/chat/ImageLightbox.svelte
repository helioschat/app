<script lang="ts">
  import { fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { Download, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-svelte';
  import Portal from '$lib/components/modal/Portal.svelte';
  import { formatFileSize } from '$lib/utils/attachments';
  import type { Attachment } from '$lib/types';

  interface Props {
    attachment: Attachment;
    isOpen: boolean;
    onclose: () => void;
  }

  let { attachment, isOpen, onclose }: Props = $props();

  // Zoom & pan state
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isPanning = $state(false);
  let lastPointerX = $state(0);
  let lastPointerY = $state(0);
  let didDrag = $state(false);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 0.5;

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  function zoomIn() {
    zoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP);
  }

  function zoomOut() {
    zoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP);
    if (zoom <= 1) {
      panX = 0;
      panY = 0;
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
    zoom = next;
    if (zoom <= 1) {
      panX = 0;
      panY = 0;
    }
  }

  function handlePointerDown(e: PointerEvent) {
    isPanning = true;
    didDrag = false;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPanning) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
    if (zoom > 1) {
      panX += dx;
      panY += dy;
    }
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  }

  function handlePointerUp(_e: PointerEvent) {
    isPanning = false;
  }

  function handleStageClick(e: MouseEvent) {
    // Only close if clicking the stage background itself, not the image
    if (e.target === e.currentTarget && !didDrag) {
      onclose();
    }
    didDrag = false;
  }

  function handleImageClick() {
    if (didDrag) return;
    if (zoom > 1) {
      resetView();
    } else {
      zoom = 2;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') onclose();
    if (e.key === '+' || e.key === '=') zoomIn();
    if (e.key === '-') zoomOut();
    if (e.key === '0') resetView();
  }

  function downloadAttachment() {
    try {
      const byteCharacters = atob(attachment.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.mimeType });
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

  // Reset view whenever the lightbox opens
  $effect(() => {
    if (isOpen) {
      resetView();
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

{#if isOpen}
  <Portal>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="lightbox-backdrop" transition:fade={{ duration: 200, easing: quintOut }}>
      <!-- Toolbar -->
      <div class="lightbox-toolbar" transition:fade={{ duration: 150 }}>
        <div class="lightbox-file-info">
          <span class="lightbox-filename">{attachment.name}</span>
          <span class="lightbox-filesize">{formatFileSize(attachment.size)}</span>
        </div>
        <div class="lightbox-controls">
          <button
            type="button"
            class="button button-ghost button-circle lightbox-btn"
            onclick={zoomOut}
            title="Zoom out (-)">
            <ZoomOut size={18} />
          </button>
          <span class="lightbox-zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            class="button button-ghost button-circle lightbox-btn"
            onclick={zoomIn}
            title="Zoom in (+)">
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            class="button button-ghost button-circle lightbox-btn"
            onclick={resetView}
            title="Reset view (0)">
            <RotateCcw size={18} />
          </button>
          <div class="lightbox-divider"></div>
          <button
            type="button"
            class="button button-ghost button-circle lightbox-btn"
            onclick={downloadAttachment}
            title="Download">
            <Download size={18} />
          </button>
          <button
            type="button"
            class="button button-ghost button-circle lightbox-btn"
            onclick={onclose}
            title="Close (Esc)">
            <X size={18} />
          </button>
        </div>
      </div>

      <!-- Image stage -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="lightbox-stage"
        class:panning={isPanning}
        onwheel={handleWheel}
        onpointerdown={handlePointerDown}
        onclick={handleStageClick}>
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          class="lightbox-image"
          style="transform: scale({zoom}) translate({panX / zoom}px, {panY / zoom}px); cursor: {isPanning
            ? 'grabbing'
            : zoom > 1
              ? 'zoom-out'
              : 'zoom-in'};"
          draggable="false"
          onclick={handleImageClick} />
      </div>
    </div>
  </Portal>
{/if}

<style lang="postcss">
  @reference "tailwindcss";

  .lightbox-backdrop {
    @apply fixed inset-0 z-50 flex flex-col;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(8px);
  }

  .lightbox-toolbar {
    @apply flex shrink-0 items-center justify-between gap-4 px-4 py-2;
    background: rgba(0, 0, 0, 0.6);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .lightbox-file-info {
    @apply flex min-w-0 items-center gap-2;
  }

  .lightbox-filename {
    @apply truncate text-sm font-medium text-white/90;
    max-width: 240px;
  }

  .lightbox-filesize {
    @apply shrink-0 text-xs text-white/50;
  }

  .lightbox-controls {
    @apply flex shrink-0 items-center gap-1;
  }

  .lightbox-zoom-label {
    @apply w-12 text-center text-xs text-white/70 tabular-nums select-none;
  }

  .lightbox-divider {
    @apply mx-1 h-5 w-px shrink-0;
    background: rgba(255, 255, 255, 0.15);
  }

  .lightbox-btn {
    @apply text-white/70 hover:bg-white/10 hover:text-white;
  }

  .lightbox-stage {
    @apply relative flex flex-1 items-center justify-center overflow-hidden;
    cursor: default;
    user-select: none;
    touch-action: none;

    &.panning {
      cursor: grabbing;
    }
  }

  .lightbox-image {
    @apply block max-h-full max-w-full rounded-sm object-contain;
    will-change: transform;
  }
</style>
