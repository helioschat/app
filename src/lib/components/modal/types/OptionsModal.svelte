<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import type { ComponentType } from 'svelte';

  export let id: string;
  export let isOpen = false;
  export let title: string;
  export let align: 'left' | 'center' = 'left';
  export let optionGroups: Array<{
    id: string;
    title: string;
    options: Array<{
      value: string;
      name: string;
      description?: string;
      icon?: ComponentType;
    }>;
    selectedValue: string;
  }>;

  const dispatch = createEventDispatcher<{
    close: void;
    select: Record<string, string>;
  }>();

  let selectedValues: Record<string, string> = {};

  $: {
    selectedValues = {};
    optionGroups.forEach((group) => {
      selectedValues[group.id] = group.selectedValue;
    });
  }

  function handleClose() {
    dispatch('close');
  }

  function handleApply() {
    dispatch('select', selectedValues);
    handleClose();
  }

  function updateSelection(groupId: string, value: string) {
    selectedValues[groupId] = value;
  }
</script>

<Modal {id} {title} {isOpen} on:close={handleClose} smallWidth>
  <div class="space-y-4">
    {#each optionGroups as group}
      <div>
        <p class="text-secondary mb-2 px-1 text-xs font-medium tracking-wide uppercase">
          {group.title}
        </p>
        <div class="flex flex-col gap-1">
          {#each group.options as option}
            <button
              type="button"
              class="button button-large w-full"
              class:!justify-center={align === 'center'}
              class:!text-center={align === 'center'}
              class:button-secondary={selectedValues[group.id] === option.value}
              class:button-tertiary={selectedValues[group.id] !== option.value}
              on:click={() => updateSelection(group.id, option.value)}>
              {#if option.icon}
                <svelte:component this={option.icon} size={15} class="text-secondary shrink-0" />
              {/if}
              <div class="flex min-w-0 flex-col">
                <span class="text-sm font-medium">{option.name}</span>
                {#if option.description}
                  <span class="text-secondary text-xs font-normal">{option.description}</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <svelte:fragment slot="footer">
    <button type="button" class="button button-ghost" on:click={handleClose}>Cancel</button>
    <button type="button" class="button button-primary" on:click={handleApply}>Apply</button>
  </svelte:fragment>
</Modal>
