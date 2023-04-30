import type { ChatCompletionRequestMessage } from 'openai';

export type ChatRequestPayload = {
  apiKey: string;
  context?: string;
  messages: ChatCompletionRequestMessage[];
};
