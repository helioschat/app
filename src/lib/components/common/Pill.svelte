<script lang="ts">
  import type { ComponentType } from 'svelte';
  import type { Icon } from 'lucide-svelte';

  export let text: string = '';
  export let variant: 'default' | 'secondary' | 'success' | 'warning' | 'error' = 'default';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let icon: ComponentType<Icon> | undefined = undefined;

  const variantClasses = {
    default: 'bg-[var(--color-a3)] text-[var(--color-12)]',
    secondary: 'bg-blue-900/30 text-blue-300',
    success: 'bg-green-900/30 text-green-300',
    warning: 'bg-yellow-900/30 text-yellow-300',
    error: 'bg-red-900/30 text-red-300',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  $: pillClasses = [
    'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
    variantClasses[variant],
    sizeClasses[size],
  ]
    .filter(Boolean)
    .join(' ');
</script>

<span class={pillClasses}>
  {#if icon}
    <svelte:component this={icon} size={iconSizes[size]} class="flex-shrink-0"></svelte:component>
  {/if}

  {#if text}
    <span>{text}</span>
  {/if}

  <slot></slot>
</span>
