import type { Message } from '$lib/types';
import { MessageProcessor } from './messageProcessor';
import { updateStreamContent, updateStreamReasoning } from './state';

export class StreamProcessor {
  private chatId: string;
  private messageId: string;
  private updateMessageCallback: (messageId: string, updater: (msg: Message) => Message) => void;

  constructor(
    chatId: string,
    messageId: string,
    updateMessageCallback: (messageId: string, updater: (msg: Message) => Message) => void,
  ) {
    this.chatId = chatId;
    this.messageId = messageId;
    this.updateMessageCallback = updateMessageCallback;
  }

  async processStream(
    reader: ReadableStreamDefaultReader<string>,
    initialContent: string = '',
  ): Promise<{
    accumulatedContent: string;
    accumulatedReasoning: string;
    thinkingTime?: number;
  }> {
    let accumulatedContent = initialContent;
    let accumulatedReasoning = '';
    let firstContentReceived = initialContent.length > 0;
    let thinkingTime: number | undefined;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const result = await MessageProcessor.processStreamChunk(
        value,
        accumulatedContent,
        accumulatedReasoning,
        firstContentReceived,
        startTime,
      );

      accumulatedContent = result.accumulatedContent;
      accumulatedReasoning = result.accumulatedReasoning;
      firstContentReceived = result.firstContentReceived;

      if (result.thinkingTime !== undefined) {
        thinkingTime = result.thinkingTime;
      }

      if (result.isReasoningChunk) {
        updateStreamReasoning(this.chatId, accumulatedReasoning);
        this.updateMessageCallback(this.messageId, (m) => ({
          ...m,
          reasoning: accumulatedReasoning,
        }));
      } else {
        updateStreamContent(this.chatId, accumulatedContent);
        const contentSnapshot = accumulatedContent; // closure capture for immutability
        this.updateMessageCallback(this.messageId, (m) => ({
          ...m,
          content: contentSnapshot,
        }));
      }
    }

    return { accumulatedContent, accumulatedReasoning, thinkingTime };
  }
}
