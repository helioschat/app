import type { Provider, ProviderConfig } from '../types';
import type { LanguageModel } from './base';
import { OpenAIProvider } from './openai';

// Provider registry - this is where we register all available providers
// Makes it easy to add new providers in the future
const providerRegistry: Record<string, new (config: ProviderConfig) => LanguageModel> = {
  openai: OpenAIProvider,
};

/**
 * Get a provider instance by ID
 * @param provider Provider ID
 * @param config Provider configuration
 * @returns LanguageModel instance
 */
export function getLanguageModel(provider: Provider, config: ProviderConfig): LanguageModel {
  const ProviderClass = providerRegistry[provider];

  if (!ProviderClass) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return new ProviderClass(config);
}

/**
 * Get all registered providers
 * @returns Array of provider IDs
 */
export function getAvailableProviders(): Provider[] {
  return Object.keys(providerRegistry) as Provider[];
}

/**
 * Register a new provider
 * @param id Provider ID
 * @param providerClass Provider class constructor
 */
export function registerProvider(id: string, providerClass: new (config: ProviderConfig) => LanguageModel): void {
  providerRegistry[id] = providerClass;
}
