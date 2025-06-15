export type AttachmentType = 'image' | 'file';

export type Attachment = {
  id: string;
  type: AttachmentType;
  name: string;
  size: number;
  mimeType: string;
  // Base64 encoded data for client-side storage
  data: string;
  // Optional preview URL for images
  previewUrl?: string;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // Optional attachment IDs for user messages - full attachments loaded separately
  attachmentIds?: string[];
  // Optional reasoning/thinking content emitted by some models
  reasoning?: string;
  providerInstanceId?: string;
  model?: string;
  usage?: TokenUsage;
  metrics?: StreamMetrics;
  createdAt: Date;
  updatedAt: Date;
  // Error information for failed assistant messages
  error?: ChatError;
};

// Message with populated attachments for UI usage
export type MessageWithAttachments = Omit<Message, 'attachmentIds'> & {
  attachments?: Attachment[];
};

export type Chat = {
  id: string;
  title: string;
  messages: MessageWithAttachments[];
  createdAt: Date;
  updatedAt: Date;
  providerInstanceId?: string;
  model?: string;
  pinned?: boolean;
  temporary?: boolean;
};

export type ProviderType = 'openai-compatible';

export const PROVIDER_TYPES: ProviderType[] = ['openai-compatible'];

export type ProviderConfig = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  matchedProvider?: string;
  providerInstanceId?: string;
  [key: string]: string | number | boolean | undefined;
};

export type ProviderInstance = {
  id: string; // unique id for the instance
  name: string; // user-defined name
  providerType: ProviderType;
  config: ProviderConfig;
};

export type SelectedModel = {
  providerInstanceId: string;
  modelId: string;
};

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface StreamMetrics {
  startTime?: number;
  endTime?: number;
  totalTime?: number;
  tokensPerSecond?: number;
  thinkingTime?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// Interface that language model implementations may satisfy for token counting
export interface TokenCountable {
  countTokens(messages: MessageWithAttachments[]): Promise<{ promptTokens: number; totalTokens: number }>;
}

export interface ChatError {
  message: string;
  type: string;
  param?: string | null;
  code?: string;
  provider?: string;
}
