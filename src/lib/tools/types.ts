import type OpenAI from 'openai';

/**
 * Represents a tool that can be called by a language model.
 * Each tool has an OpenAI-compatible function definition and an executor.
 */
export interface Tool {
  /** Human-readable name shown in the UI (e.g. "Exa Search") */
  displayName: string;
  /** Short description shown in the UI (e.g. "Web search") */
  displayDescription?: string;
  /** The OpenAI-compatible function definition sent to the model */
  definition: OpenAI.Chat.Completions.ChatCompletionTool;
  /**
   * Execute the tool with the given JSON-serialised arguments.
   * Must return a JSON-serialisable result object.
   */
  execute(args: string): Promise<unknown>;
}
