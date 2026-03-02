import type { MessageWithAttachments, ToolCall, ToolResult } from '$lib/types';
import { MessageProcessor } from './messageProcessor';
import { updateStreamContent, updateStreamReasoning } from './state';

export class StreamProcessor {
  private chatId: string;
  private messageId: string;
  private updateMessageCallback: (
    messageId: string,
    updater: (msg: MessageWithAttachments) => MessageWithAttachments,
  ) => void;

  constructor(
    chatId: string,
    messageId: string,
    updateMessageCallback: (
      messageId: string,
      updater: (msg: MessageWithAttachments) => MessageWithAttachments,
    ) => void,
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
    accumulatedToolCalls: ToolCall[];
    accumulatedToolResults: ToolResult[];
    thinkingTime?: number;
  }> {
    let accumulatedContent = initialContent;
    let accumulatedReasoning = '';
    let accumulatedToolCalls: ToolCall[] = [];
    let accumulatedToolResults: ToolResult[] = [];
    let firstContentReceived = initialContent.length > 0;
    let thinkingTime: number | undefined;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      try {
        const parsedValue = JSON.parse(value);

        if (parsedValue.type === 'attachment' && parsedValue.data) {
          // Handle attachment by adding it to the message
          this.updateMessageCallback(this.messageId, (m) => ({
            ...m,
            attachments: m.attachments ? [...m.attachments, parsedValue.data] : [parsedValue.data],
          }));
        } else if (parsedValue.type === 'tool_calls' && Array.isArray(parsedValue.data)) {
          // Handle tool calls emitted by the provider
          const newCalls: ToolCall[] = parsedValue.data.map((tc: { id: string; name: string; arguments: string }) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          }));
          accumulatedToolCalls = [...accumulatedToolCalls, ...newCalls];
          this.updateMessageCallback(this.messageId, (m) => ({
            ...m,
            toolCalls: accumulatedToolCalls,
          }));
        } else if (parsedValue.type === 'tool_result' && parsedValue.data) {
          // Handle a tool execution result
          const result: ToolResult = {
            toolCallId: parsedValue.data.toolCallId,
            name: parsedValue.data.name,
            result: parsedValue.data.result,
            error: parsedValue.data.error,
          };
          accumulatedToolResults = [...accumulatedToolResults, result];
          this.updateMessageCallback(this.messageId, (m) => ({
            ...m,
            toolResults: accumulatedToolResults,
          }));
        } else {
          throw new Error('Unrecognised JSON event');
        }
      } catch {
        // Not a valid JSON event, treat as text or reasoning chunk
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
    }

    return { accumulatedContent, accumulatedReasoning, accumulatedToolCalls, accumulatedToolResults, thinkingTime };
  }
}
