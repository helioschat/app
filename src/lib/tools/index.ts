import type { ToolsSettings } from '$lib/settings/SettingsManager';
import { ExaSearchTool } from './exaSearch';
import { MathEvaluatorTool } from './mathEvaluator';
import type { Tool } from './types';

/**
 * Build the list of tools to make available to the model.
 * Only includes tools that are enabled and fully configured.
 */
export function buildTools(toolsSettings: ToolsSettings): Tool[] {
  const tools: Tool[] = [];

  if (toolsSettings.exa.enabled && toolsSettings.exa.apiKey.trim()) {
    tools.push(new ExaSearchTool(toolsSettings.exa.apiKey));
  }

  if (toolsSettings.mathEvaluator.enabled) {
    tools.push(new MathEvaluatorTool());
  }

  return tools;
}

/**
 * Static map from function name → display name for UI rendering.
 * Kept in sync with the tool definitions above.
 */
const TOOL_DISPLAY_NAMES: Record<string, { displayName: string; displayDescription?: string }> = {
  exa_web_search: { displayName: 'Exa Search', displayDescription: 'Web search' },
  math_evaluate: { displayName: 'Math Evaluator', displayDescription: 'Evaluate mathematical expressions' },
};

/**
 * Returns a human-readable display name for a tool given its function name.
 * Falls back to the raw function name if unknown.
 */
export function getToolDisplayInfo(functionName: string): { displayName: string; displayDescription?: string } {
  return TOOL_DISPLAY_NAMES[functionName] ?? { displayName: functionName };
}

export type { Tool };
