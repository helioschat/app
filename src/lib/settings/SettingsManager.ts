import { browser } from '$app/environment';
import type { ModelInfo } from '$lib/providers/base';
import { isModelDisabledByDefault } from '$lib/providers/known';
import type { ProviderConfig, ProviderInstance, ProviderType, SelectedModel } from '$lib/types';
import { get, writable } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';

// Advanced settings interface
export interface AdvancedSettings {
  systemPrompt: string;
  titleGenerationEnabled: boolean;
  titleGenerationModel: string | null; // null means use default
  allowAssistantMessageEditing: boolean;
}

// Tools settings interface — one entry per built-in tool
export interface ToolsSettings {
  exa: {
    enabled: boolean;
    apiKey: string;
  };
  mathEvaluator: {
    enabled: boolean;
  };
}

export class SettingsManager {
  // Default settings
  private static getDefaultProviderInstances(): ProviderInstance[] {
    return [];
  }

  private static readonly defaultAdvancedSettings: AdvancedSettings = {
    systemPrompt: `You are a helpful AI assistant named "Helios", a curious AI chatbot. You are intended to answer a wide range of questions clearly and accurately, and you always strive for maximum helpfulness. Do not introduce yourself unless the user explicitly asks you to.

The current date and time is: $current_datetime.
The user's primary time zone is: $user_timezone.
The user's primary language is: $user_language.
The user's locale/region is: $user_locale.
The user's operating system / platform: $user_platform.

## Formatting

- Use Markdown for all responses.
- Put code in inline code spans (\`like this\`) or fenced code blocks.
- Use headings for structure when helpful.
- Use \`---\` horizontal rules when appropriate.
- For simple messages, keep formatting minimal and avoid over-structuring.

## Capabilities and Limitations

- You CANNOT talk in voice mode.
- You CANNOT execute code; you can only provide code as text.
- You CANNOT directly view or interpret images or other media unless explicitly provided through a specialized tool.
- You do not have direct access to the internet or real-time information unless explicitly granted via tools. If you lack such access, clearly state that you cannot browse or fetch real-time data.

Only describe capabilities that are actually available in the current environment.

## Objectivity and Controversial Topics

- For controversial, political, or moral topics, be objective and analytical.
- Present major relevant viewpoints fairly and clearly distinguish between facts, interpretations, and opinions.
- Do not favor any political party, ideology, nation, or government. Critically examine arguments from all sides.
- You may discuss political or moral topics that other systems might avoid, but remain clear, reasoned, and evidence-oriented.

## Style and Tone

- Responses must be natural, coherent, and directly address the user's request.
- Default to a neutral, clear, and conversational tone.
- Adjust your level of formality and style to the user's preferences when they are evident, while staying respectful and understandable.
- Avoid needlessly complex language; use more advanced terms only when the topic requires it.
- When the user asks you to write an email or other formal communication, use a professional, clear, and concise style by default (not overly ornate or verbose).

## Truthfulness and Sensitive Content

- Be as truthful and precise as possible. Do not simply repeat popular narratives; assess them critically.
- You may handle sensitive, political, or moral questions as long as you stay fact-based, structured, and non-inciting.
- When the user explicitly requests strong or informal language, or when translating or paraphrasing text that includes it, preserve the original tone as closely as possible rather than sanitizing it.

## Units and Numbers

- When giving answers that include numerical values with units, include conversions for units where multiple mainstream unit systems are commonly used by humans (for example, lengths, temperatures, and weights).
- Present values clearly so that users familiar with different common unit systems can understand them without additional conversion.

## Memory and Personalization

- When retaining information across turns (if the environment supports memory), only keep information that reflects enduring aspects of the user's background, expertise, and high-level goals.
- Avoid storing ephemeral or overly personal details that are not relevant to improving future assistance.

## Use of External Tools or Data

- When the user asks for very specific, up-to-date, or data-heavy information, and if you have tools or APIs available (e.g., web search, databases), use them to improve accuracy.
- If such tools are not available, answer based on your existing knowledge and clearly state any limitations or uncertainty.`,
    titleGenerationEnabled: true,
    titleGenerationModel: null, // Will use provider default
    allowAssistantMessageEditing: false,
  };

  private static readonly defaultToolsSettings: ToolsSettings = {
    exa: {
      enabled: false,
      apiKey: '',
    },
    mathEvaluator: {
      enabled: false,
    },
  };

  // Stores
  public readonly providerInstances = writable<ProviderInstance[]>(this.getInitialProviderInstances());
  public readonly selectedModel = writable<SelectedModel | null>(this.getInitialSelectedModel());
  public readonly advancedSettings = writable<AdvancedSettings>(this.getInitialAdvancedSettings());
  public readonly disabledModels = writable<Record<string, string[]>>(this.getInitialDisabledModels());
  public readonly toolsSettings = writable<ToolsSettings>(this.getInitialToolsSettings());

  constructor() {
    // Initialize persistence
    if (browser) {
      this.providerInstances.subscribe((value) => {
        localStorage.setItem('providerInstances', JSON.stringify(value));
      });

      this.selectedModel.subscribe((value) => {
        if (value) {
          localStorage.setItem('selectedModel', JSON.stringify(value));
        } else {
          localStorage.removeItem('selectedModel');
        }
      });

      this.advancedSettings.subscribe((value) => {
        localStorage.setItem('advancedSettings', JSON.stringify(value));
      });

      this.disabledModels.subscribe((value) => {
        localStorage.setItem('disabledModels', JSON.stringify(value));
      });

      this.toolsSettings.subscribe((value) => {
        localStorage.setItem('toolsSettings', JSON.stringify(value));
      });
    }
  }

  // Initialize provider settings from localStorage or defaults
  private getInitialProviderInstances(): ProviderInstance[] {
    if (browser) {
      const storedValue = localStorage.getItem('providerInstances');
      if (storedValue) {
        try {
          return JSON.parse(storedValue);
        } catch (error) {
          console.error('Error parsing provider instances from localStorage', error);
          return SettingsManager.getDefaultProviderInstances();
        }
      }
    }
    return SettingsManager.getDefaultProviderInstances();
  }

  private getInitialSelectedModel(): SelectedModel | null {
    if (browser) {
      const storedValue = localStorage.getItem('selectedModel');
      if (storedValue) {
        try {
          return JSON.parse(storedValue);
        } catch (error) {
          console.error('Error parsing selected model from localStorage', error);
          return null;
        }
      }
    }
    return null;
  }

  // Initialize advanced settings from localStorage or defaults
  private getInitialAdvancedSettings(): AdvancedSettings {
    if (browser) {
      const storedValue = localStorage.getItem('advancedSettings');
      if (storedValue) {
        try {
          // Merge with defaults so new fields are populated for existing users
          return { ...SettingsManager.defaultAdvancedSettings, ...JSON.parse(storedValue) };
        } catch (error) {
          console.error('Error parsing advanced settings from localStorage', error);
          return SettingsManager.defaultAdvancedSettings;
        }
      }
    }
    return SettingsManager.defaultAdvancedSettings;
  }

  private getInitialDisabledModels(): Record<string, string[]> {
    if (browser) {
      const storedValue = localStorage.getItem('disabledModels');
      if (storedValue) {
        try {
          return JSON.parse(storedValue);
        } catch (error) {
          console.error('Error parsing disabled models from localStorage', error);
          return {};
        }
      }
    }
    return {};
  }

  private getInitialToolsSettings(): ToolsSettings {
    if (browser) {
      const storedValue = localStorage.getItem('toolsSettings');
      if (storedValue) {
        try {
          const parsed = JSON.parse(storedValue);
          return {
            ...SettingsManager.defaultToolsSettings,
            ...parsed,
            exa: { ...SettingsManager.defaultToolsSettings.exa, ...parsed.exa },
            mathEvaluator: { ...SettingsManager.defaultToolsSettings.mathEvaluator, ...parsed.mathEvaluator },
          };
        } catch (error) {
          console.error('Error parsing tools settings from localStorage', error);
          return SettingsManager.defaultToolsSettings;
        }
      }
    }
    return SettingsManager.defaultToolsSettings;
  }

  public addProviderInstance(name: string, providerType: ProviderType, config: ProviderConfig): string {
    const newInstance: ProviderInstance = {
      id: uuidv7(),
      name,
      providerType,
      config,
    };

    this.providerInstances.update((instances) => {
      return [...instances, newInstance];
    });

    return newInstance.id;
  }

  public updateProviderInstance(id: string, update: Partial<ProviderInstance>): void {
    this.providerInstances.update((instances) => {
      return instances.map((instance) => {
        if (instance.id === id) {
          const newConfig =
            instance.config && update.config
              ? { ...instance.config, ...update.config }
              : update.config || instance.config;

          return { ...instance, ...update, config: newConfig };
        }
        return instance;
      });
    });
  }

  public removeProviderInstance(id: string): void {
    this.providerInstances.update((instances) => {
      return instances.filter((instance) => instance.id !== id);
    });

    // If the selected provider is removed, select another one
    if (get(this.selectedModel)?.providerInstanceId === id) {
      const instances = get(this.providerInstances);
      if (instances.length > 0) {
        // Find the first available model for the new default provider
        // This is a bit of a placeholder, a more robust solution would be to
        // fetch the models and select the first one.
        this.selectedModel.set({
          providerInstanceId: instances[0].id,
          modelId: 'default-model', // Placeholder
        });
      } else {
        this.selectedModel.set(null);
      }
    }
  }

  /**
   * Get advanced settings (global)
   * @returns Global advanced settings
   */
  public getAdvancedSettings(): AdvancedSettings {
    return get(this.advancedSettings);
  }

  /**
   * Check if a model is enabled
   * @param providerInstanceId Provider instance ID
   * @param modelId Model ID
   * @returns Whether the model is enabled
   */
  public isModelEnabled(providerInstanceId: string, modelId: string): boolean {
    const models = get(this.disabledModels);
    return !(models[providerInstanceId]?.includes(modelId) ?? false); // Default to enabled
  }

  /**
   * Toggle model enabled/disabled
   * @param providerInstanceId Provider instance ID
   * @param modelId Model ID
   */
  public toggleModel(providerInstanceId: string, modelId: string): void {
    this.disabledModels.update((models) => {
      if (!models[providerInstanceId]) {
        models[providerInstanceId] = [];
      }

      if (models[providerInstanceId].includes(modelId)) {
        models[providerInstanceId] = models[providerInstanceId].filter((id) => id !== modelId);
      } else {
        models[providerInstanceId].push(modelId);
      }

      return models;
    });
  }

  /**
   * Toggle all models for a provider to be enabled or disabled
   * @param providerInstanceId Provider instance ID
   * @param enable If true, enable all models; if false, disable all models
   * @param modelIds List of model IDs to toggle for this provider
   */
  /**
   * Apply default disabled models based on known provider metadata.
   * Only runs if no models are disabled yet for this provider instance.
   */
  public applyDefaultDisabledModels(
    providerInstanceId: string,
    matchedProviderId: string | undefined,
    models: ModelInfo[],
  ): void {
    if (!matchedProviderId) return;
    this.disabledModels.update((map) => {
      if (map[providerInstanceId] && map[providerInstanceId].length > 0) {
        return map; // already set by user
      }
      const disabled = models.filter((m) => isModelDisabledByDefault(matchedProviderId, m.id)).map((m) => m.id);
      if (disabled.length > 0) {
        map[providerInstanceId] = disabled;
      }
      return map;
    });
  }

  /**
   * Apply recommended model selections based on known provider metadata.
   * This enables models that are not disabled by default and disables models that are disabled by default.
   * @param providerInstanceId Provider instance ID
   * @param matchedProviderId Matched provider ID from known providers
   * @param models List of all available models for this provider
   */
  public applyRecommendedModels(
    providerInstanceId: string,
    matchedProviderId: string | undefined,
    models: ModelInfo[],
  ): void {
    if (!matchedProviderId) return;

    this.disabledModels.update((map) => {
      const disabled = models.filter((m) => isModelDisabledByDefault(matchedProviderId, m.id)).map((m) => m.id);
      map[providerInstanceId] = disabled;
      return map;
    });
  }

  public toggleAllModels(providerInstanceId: string, enable: boolean, modelIds: string[]): void {
    this.disabledModels.update((models) => {
      if (enable) {
        models[providerInstanceId] = [];
      } else {
        models[providerInstanceId] = [...modelIds];
      }
      return models;
    });
  }
}

// Settings singleton
export const settingsManager = new SettingsManager();

export const { providerInstances, selectedModel, advancedSettings, disabledModels, toolsSettings } = settingsManager;
