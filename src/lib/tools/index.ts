import type { ToolsSettings } from '$lib/settings/SettingsManager';
import { ExaSearchTool } from './exaSearch';
import { ManageMemoriesTool } from './manageMemories';
import { MathEvaluatorTool } from './mathEvaluator';
import type { Tool } from './types';

/**
 * Build the list of tools to make available to the model.
 *
 * @param toolsSettings  - Global tool settings (Exa key, math evaluator toggle, etc.)
 * @param toolUseEnabled - Whether the user-facing "Tools" toggle is on (gates Exa / math)
 * @param memoryEnabled  - Whether the memory toggle is on (independent of toolUseEnabled)
 */
export function buildTools(toolsSettings: ToolsSettings, toolUseEnabled = true, memoryEnabled = true): Tool[] {
  const tools: Tool[] = [];

  if (toolUseEnabled) {
    if (toolsSettings.exa.enabled && toolsSettings.exa.apiKey.trim()) {
      tools.push(new ExaSearchTool(toolsSettings.exa.apiKey));
    }

    if (toolsSettings.mathEvaluator.enabled) {
      tools.push(new MathEvaluatorTool());
    }
  }

  if (memoryEnabled) {
    tools.push(new ManageMemoriesTool());
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
  manage_memories: { displayName: 'Memory', displayDescription: 'Manage personal memories' },
};

/**
 * Returns a human-readable display name for a tool given its function name.
 * Falls back to the raw function name if unknown.
 */
export function getToolDisplayInfo(functionName: string): { displayName: string; displayDescription?: string } {
  return TOOL_DISPLAY_NAMES[functionName] ?? { displayName: functionName };
}

export type { Tool };
