import type { ModelInfo } from '$lib/providers/base';
import type { ProviderConfig, ProviderType } from '../types';

type ModelInfoOverride = Partial<ModelInfo>;

export interface KnownProviderMetadata {
  id: ProviderType | (string & {});
  name: string;
  icon?: string;
  description?: string;
  /** List of models to hide/disable by default. Supports full string match or RegExp */
  disabledModels?: (string | RegExp)[];
  modelOverrides?: Record<string, ModelInfoOverride>;
  /** Optional list of (string or RegExp) patterns that, when matched
   * against the `baseURL`, identify this provider automatically. */
  baseUrlPatterns?: (string | RegExp)[];
  /** Optional api-key prefix patterns that can be used to auto-detect
   * the provider from the key alone. */
  apiKeyPrefixes?: string[];
  /** Default model to use for title generation (should be fast and cheap) */
  defaultTitleModel?: string;
}

export function getKnownProviderMeta(id: string): KnownProviderMetadata | undefined {
  return KNOWN_PROVIDERS[id];
}

export function isModelDisabledByDefault(providerId: string, modelId: string): boolean {
  const meta = KNOWN_PROVIDERS[providerId];
  if (!meta?.disabledModels) return false;
  return meta.disabledModels.some((pat) => (typeof pat === 'string' ? pat === modelId : pat.test(modelId)));
}

/** Retrieve metadata override for a specific model */
export function getModelMetadata(providerId: string, modelId: string): ModelInfoOverride | undefined {
  const provider = KNOWN_PROVIDERS[providerId];
  if (!provider) return undefined;
  return provider.modelOverrides?.[modelId];
}

/**
 * Merge model overrides into a list of ModelInfo objects returned by the provider.
 * The original array is NOT mutated.
 */
export function applyModelOverrides(providerId: string, models: ModelInfo[]): ModelInfo[] {
  const provider = KNOWN_PROVIDERS[providerId];
  if (!provider?.modelOverrides) return models;

  const overrides = provider.modelOverrides;
  const merged = models.map((m) => {
    const o = overrides[m.id];
    return o ? ({ ...m, ...o } as ModelInfo) : m;
  });

  // Also include overrides for models that the provider didn't return
  for (const [modelId, meta] of Object.entries(overrides)) {
    if (!merged.some((m) => m.id === modelId)) {
      merged.push({ id: modelId, name: modelId, ...meta } as ModelInfo);
    }
  }
  return merged;
}

export function detectKnownProvider(config: ProviderConfig): string | undefined {
  for (const [id, meta] of Object.entries(KNOWN_PROVIDERS)) {
    const url = config.baseURL;
    if (url && meta.baseUrlPatterns?.some((pat) => (typeof pat === 'string' ? url.includes(pat) : pat.test(url)))) {
      return id;
    }

    const key = config.apiKey as string | undefined;
    if (key && meta.apiKeyPrefixes?.some((prefix) => key.startsWith(prefix))) {
      return id;
    }
  }
  return undefined;
}

export function getDefaultTitleModel(providerId: string): string | undefined {
  const provider = KNOWN_PROVIDERS[providerId];
  return provider?.defaultTitleModel;
}

export const KNOWN_PROVIDERS: Record<string, KnownProviderMetadata> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultTitleModel: 'gpt-4.1-nano',
    disabledModels: [
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106',
      'gpt-3.5-turbo-instruct-0914',
      'gpt-4-0613',
      'gpt-4-turbo-2024-04-09',
      'gpt-4o-2024-05-13',
      'gpt-4o-mini-2024-07-18',
      'o1-preview-2024-09-12',
      'o1-mini-2024-09-12',
      'o1-2024-12-17',
      'o1-pro-2025-03-19',
      'o4-mini-2025-04-16',
      'o3-mini-2025-01-31',
      'o3-2025-04-16',
      'o3-pro-2025-06-10',
      'gpt-4.1-2025-04-14',
      'gpt-4.1-nano-2025-04-14',
      'gpt-4.1-mini-2025-04-14',
      'gpt-4o-2024-08-06',
      'gpt-4o-2024-11-20',
      'gpt-3.5-turbo-16k',
      'gpt-4.5-preview-2025-02-27',
      /^gpt-.*-search-preview.*$/,
      /^gpt-.*-audio.*$/,
      /^gpt-.*-realtime.*$/,
      /^gpt-.*-tts$/,
      /^gpt-.*-preview.*$/,
      /^gpt-.*-transcribe.*$/,
      /^gpt-.*-instruct.*$/,
      /^o1-preview.*$/,
      /^whisper-.*$/,
      /^codex-.*$/,
      /^davinci-.*$/,
      /^babbage-.*$/,
      /^omni-.*$/,
      /^tts-.*$/,
      /^text-embedding-.*$/,
    ],
    modelOverrides: {
      'chatgpt-4o-latest': {
        name: 'ChatGPT 4o',
        description: 'GPT-4o model used in ChatGPT',
        contextWindow: 128000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        description: 'Legacy GPT model for cheaper chat and non-chat tasks',
        contextWindow: 16385,
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-4': {
        name: 'GPT-4',
        description: 'An older high-intelligence GPT model',
        contextWindow: 8192,
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-4-turbo': {
        name: 'GPT-4 Turbo',
        description: 'An older high-intelligence GPT model',
        contextWindow: 128000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-4.1': {
        name: 'GPT-4.1',
        description: 'Flagship GPT model for complex tasks',
        contextWindow: 1047576,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-4.1-mini': {
        name: 'GPT-4.1 mini',
        description: 'Balanced for intelligence, speed, and cost',
        contextWindow: 1047576,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-4.1-nano': {
        name: 'GPT-4.1 nano',
        description: 'Fastest, most cost-effective GPT-4.1 model',
        contextWindow: 1047576,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-4o': {
        name: 'GPT-4o',
        description: 'Fast, intelligent, flexible GPT model',
        contextWindow: 128000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'gpt-4o-mini': {
        name: 'GPT-4o mini',
        description: 'Fast, affordable small model for focused tasks',
        contextWindow: 128000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
      },
      'o1-pro': {
        name: 'o1-pro',
        description: 'Version of o1 with more compute for better responses',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: true,
        // TODO: reasoningTokenSupport: true,
      },
      o1: {
        name: 'o1',
        description: 'Previous full o-series reasoning model',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
        // TODO: reasoningTokenSupport: true,
      },
      'o1-mini': {
        name: 'o1-mini',
        description: 'A small model alternative to o1',
        contextWindow: 128000,
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['text'],
        },
        deprecated: true,
        supportsResponsesEndpoint: false,
        doesntSupportChatCompletionsEndpoint: false,
        // TODO: reasoningTokenSupport: true,
      },
      'o3-pro': {
        name: 'o3-pro',
        description: 'Version of o3 with more compute for better responses',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: true,
        // TODO: reasoningTokenSupport: true,
      },
      o3: {
        name: 'o3',
        description: 'Our most powerful reasoning model',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
        // TODO: reasoningTokenSupport: true,
      },
      'o3-mini': {
        name: 'o3-mini',
        description: 'A small model alternative to o3',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
        // TODO: reasoningTokenSupport: true,
      },
      'o4-mini': {
        name: 'o4-mini',
        description: 'Faster, more affordable reasoning model',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
        supportsResponsesEndpoint: true,
        doesntSupportChatCompletionsEndpoint: false,
        // TODO: reasoningTokenSupport: true,
      },
      'gpt-image-1': {
        name: 'GPT Image 1',
        description: 'State-of-the-art image generation model',
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['image'],
        },
      },
      'dall-e-3': {
        name: 'DALL-E 3',
        description: 'Previous generation image generation model',
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['image'],
        },
      },
      'dall-e-2': {
        name: 'DALL-E 2',
        description: 'Our first image generation model',
        architecture: {
          inputModalities: ['text'],
          outputModalities: ['image'],
        },
      },
    },
    baseUrlPatterns: [/https?:\/\/api\.openai\.com/],
    apiKeyPrefixes: ['sk-proj-'],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultTitleModel: 'meta-llama/llama-3.3-8b-instruct:free',
    baseUrlPatterns: [/https?:\/\/openrouter\.ai\/api/],
    apiKeyPrefixes: ['sk-or-v1-'],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    defaultTitleModel: 'claude-3-haiku-20240307',
    disabledModels: ['claude-3-5-sonnet-20240620'],
    modelOverrides: {
      // https://docs.anthropic.com/en/docs/about-claude/models/overview
      'claude-opus-4-20250514': {
        name: 'Claude Opus 4',
        description: 'Our most capable model',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
      },
      'claude-sonnet-4-20250514': {
        name: 'Claude Sonnet 4',
        description: 'High-performance model',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
      },
      'claude-3-7-sonnet-20250219': {
        name: 'Claude 3.7 Sonnet',
        description: 'High-performance model with early extended thinking',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
      },
      'claude-3-5-sonnet-20241022': {
        name: 'Claude 3.5 Sonnet',
        description: 'Our previous intelligent model',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
      },
      'claude-3-5-haiku-20241022': {
        name: 'Claude 3.5 Haiku',
        description: 'Our fastest model',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
      },
      'claude-3-opus-20240229': {
        name: 'Claude 3 Opus',
        description: 'Powerful model for complex tasks',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
      },
      'claude-3-haiku-20240307': {
        name: 'Claude 3 Haiku',
        description: 'Fast and compact model for near-instant responsiveness',
        contextWindow: 200000,
        architecture: {
          inputModalities: ['text', 'image'],
          outputModalities: ['text'],
        },
      },
    },
    baseUrlPatterns: [/https?:\/\/api\.anthropic\.com/],
    apiKeyPrefixes: ['sk-ant-api'],
  },
  'google-openai': {
    id: 'google-openai',
    name: 'Google (OpenAI compatible)',
    defaultTitleModel: 'gemini-2.0-flash',
    disabledModels: [/^embedding-.*$/, /^text-embedding-.*$/, /^veo-.*$/],
    baseUrlPatterns: [/https?:\/\/generativelanguage\.googleapis.com\/v1beta\/openai\//],
    apiKeyPrefixes: undefined, // Google doesn't have a specific API key prefix that identifies it
  },
};
