import type { ProviderConfig, ProviderType } from '../types';
import type { LanguageModel } from './base';
import { OpenAICompatibleProvider } from './openai-compatible';

// Provider registry - this is where we register all available providers
// Makes it easy to add new providers in the future
const providerRegistry: Record<string, new (config: ProviderConfig) => LanguageModel> = {
  'openai-compatible': OpenAICompatibleProvider,
};

/**
 * Get a provider instance by ID
 * @param providerType Provider Type
 * @param config Provider configuration
 * @returns LanguageModel instance
 */
export function getLanguageModel(providerType: ProviderType, config: ProviderConfig): LanguageModel {
  const ProviderClass = providerRegistry[providerType];

  if (!ProviderClass) {
    throw new Error(`Unsupported provider: ${providerType}`);
  }

  return new ProviderClass(config);
}

/**
 * Get all registered provider types
 * @returns Array of provider types
 */
export function getAvailableProviderTypes(): ProviderType[] {
  return Object.keys(providerRegistry) as ProviderType[];
}

/**
 * Register a new provider
 * @param id Provider ID
 * @param providerClass Provider class constructor
 */
export function registerProvider(id: string, providerClass: new (config: ProviderConfig) => LanguageModel): void {
  providerRegistry[id] = providerClass;
}
