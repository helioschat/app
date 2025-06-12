import type { Message } from '$lib/types';
import type { StreamMetrics, TokenCountable } from './types';

export class MessageProcessor {
  static async estimatePromptTokens(messages: Message[], model: unknown): Promise<number> {
    // Type guard for TokenCountable
    if (this.isTokenCountable(model)) {
      const tokenInfo = await model.countTokens(messages);
      return tokenInfo.promptTokens;
    }
    // Rough estimate: 0.75 token per word (OpenAI-ish)
    const words = messages.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0);
    return Math.round(words * 0.75);
  }

  private static isTokenCountable(obj: unknown): obj is TokenCountable {
    return typeof (obj as TokenCountable).countTokens === 'function';
  }

  static calculateStreamMetrics(
    startTime: number,
    completionTokens: number,
    promptTokens?: number,
    thinkingTime?: number,
  ): StreamMetrics {
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const totalTokens = (promptTokens || 0) + completionTokens;
    const tokensPerSecond = completionTokens > 0 ? completionTokens / (totalTime / 1000) : undefined;

    return {
      startTime,
      endTime,
      totalTime,
      promptTokens,
      completionTokens,
      totalTokens,
      tokensPerSecond,
      thinkingTime,
    };
  }

  static async processStreamChunk(
    value: string,
    accumulatedContent: string,
    accumulatedReasoning: string,
    firstContentReceived: boolean,
    startTime: number,
  ): Promise<{
    accumulatedContent: string;
    accumulatedReasoning: string;
    firstContentReceived: boolean;
    thinkingTime?: number;
    isReasoningChunk: boolean;
  }> {
    let thinkingTime: number | undefined;
    let isReasoningChunk = false;

    if (value.startsWith('[REASONING]')) {
      const reasoningChunk = value.substring('[REASONING]'.length);
      accumulatedReasoning += reasoningChunk;
      isReasoningChunk = true;
    } else {
      if (!firstContentReceived) {
        thinkingTime = Date.now() - startTime;
        firstContentReceived = true;
      }
      accumulatedContent += value;
    }

    return {
      accumulatedContent,
      accumulatedReasoning,
      firstContentReceived,
      thinkingTime,
      isReasoningChunk,
    };
  }
}
