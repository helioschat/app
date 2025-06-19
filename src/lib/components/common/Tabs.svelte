<script lang="ts">
  import { onMount } from 'svelte';

  export let name: string = 'switch';
  export let tabs: {
    id: string;
    text: string;
    disabled?: boolean | null;
    hidden?: boolean | null;
  }[];
  export let activeTab: string | undefined = undefined;
  export let initialActiveTab: string | undefined = undefined;
  export let disabled: boolean | undefined = false;
  export let onChange: void | (() => void) | ((e: Event) => void) | undefined = undefined;

  onMount(() => {
    if (activeTab) handleClick(activeTab);
    if (initialActiveTab) handleClick(initialActiveTab);
  });

  let container: HTMLDivElement | undefined;

  const bg = {
    width: 0,
    height: 0,
    x: 0,
    isHovering: false,
  };

  const tabFocus = (e: MouseEvent, tabDisabled?: boolean | null) => {
    if (disabled || tabDisabled) return;

    const target = e.target as HTMLElement;
    if (!target) return;

    const rect = target.getBoundingClientRect();

    bg.width = rect.width;
    bg.height = rect.height;
    bg.x = target.offsetLeft + window.scrollX;
  };

  const addTabFocus = () => {
    setTimeout(() => {
      bg.isHovering = true;
    }, 25);
  };

  const removeTabFocus = () => {
    bg.isHovering = false;
  };

  const handleClick = (tabId: string) => {
    if (!container) return;
    (container.querySelector(`#switch-${tabId}`) as HTMLInputElement | undefined)?.click();
    activeTab = tabId;
  };

  const handleOnChange = (e: Event) => {
    if (onChange) onChange(e);
  };
</script>

<div class="bg-app-secondary w-full rounded-lg p-1">
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- This is only cosmetic, we don't need to watch out for a11y here -->
  <div on:mouseenter={addTabFocus} on:mouseleave={removeTabFocus}>
    <div class="relative flex" bind:this={container}>
      {#each tabs.filter((tab) => tab.hidden !== true) as tab}
        <input
          type="radio"
          {name}
          id={`switch-${tab.id}`}
          value={tab.id}
          hidden
          checked={(() => {
            if (initialActiveTab == tab.id) {
              activeTab = tab.id;
              return true;
            }
            return undefined;
          })()}
          on:change={handleOnChange} />
        {@const isDisabled = disabled || tab.disabled}
        <button
          class="tab peer z-[1] flex h-8 w-full min-w-fit cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg px-4"
          disabled={isDisabled}
          class:disabled={isDisabled}
          class:text-secondary={isDisabled || tab.id != activeTab}
          class:active={tab.id == activeTab}
          on:click={(e) => {
            e.preventDefault();
            handleClick(tab.id);
          }}
          on:mouseenter={(e) => tabFocus(e, isDisabled)}>
          <p class="line-clamp-1 min-w-0 text-sm font-medium break-words select-none">
            {tab.text}
          </p>
        </button>
      {/each}
      <div
        class="bg bg-component-hover peer-hover absolute left-0 rounded-lg opacity-0 peer-hover:opacity-60"
        class:hover={bg.isHovering}
        style="width: {bg.width}px; height: {bg.height}px; transform: translateX({bg.x}px);"
        aria-hidden="true">
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .tab.peer ~ .bg.peer-hover {
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    contain: strict;
  }

  .tab.peer:hover ~ .bg.peer-hover.hover {
    transition-property: opacity, width, transform !important;
  }

  .tab.active {
    background-color: var(--color-4);
  }

  .tab.disabled {
    @apply cursor-not-allowed;
  }
</style>
