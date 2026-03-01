<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import OptionsModal from './OptionsModal.svelte';
  import { Brain, Zap, Gauge, Target } from 'lucide-svelte';

  export let id: string;
  export let isOpen = false;
  export let currentEffort: 'minimal' | 'low' | 'medium' | 'high' = 'medium';
  export let currentSummary: 'auto' | 'concise' | 'detailed' = 'auto';
  export let supportsReasoningSummary: boolean = true;

  const dispatch = createEventDispatcher<{
    close: void;
    select: { effort: 'minimal' | 'low' | 'medium' | 'high'; summary: 'auto' | 'concise' | 'detailed' };
  }>();

  $: optionGroups = [
    {
      id: 'effort',
      title: 'Reasoning Effort',
      selectedValue: currentEffort,
      options: [
        {
          value: 'minimal',
          name: 'Minimal',
          description: 'Quick responses with basic reasoning',
          icon: Zap,
        },
        {
          value: 'low',
          name: 'Low',
          description: 'Light reasoning for simple tasks',
          icon: Gauge,
        },
        {
          value: 'medium',
          name: 'Medium',
          description: 'Balanced reasoning for most tasks',
          icon: Brain,
        },
        {
          value: 'high',
          name: 'High',
          description: 'Deep reasoning for complex problems',
          icon: Target,
        },
      ],
    },
    ...(supportsReasoningSummary
      ? [
          {
            id: 'summary',
            title: 'Summary Style',
            selectedValue: currentSummary,
            options: [
              {
                value: 'auto',
                name: 'Auto',
                description: 'Let the model decide summary level',
              },
              {
                value: 'concise',
                name: 'Concise',
                description: 'Brief reasoning summaries',
              },
              {
                value: 'detailed',
                name: 'Detailed',
                description: 'Comprehensive reasoning explanations',
              },
            ],
          },
        ]
      : []),
  ];

  function handleClose() {
    dispatch('close');
  }

  function handleSelect(event: CustomEvent<Record<string, string>>) {
    const values = event.detail;
    dispatch('select', {
      effort: values.effort as 'minimal' | 'low' | 'medium' | 'high',
      summary: (supportsReasoningSummary ? values.summary : currentSummary) as 'auto' | 'concise' | 'detailed',
    });
  }
</script>

<OptionsModal {id} {isOpen} title="Reasoning Options" {optionGroups} on:close={handleClose} on:select={handleSelect} />
