import { MessageUsage } from "src/types/chat";

// Normalized tool call coming from a provider response
export interface NormalizedToolCall {
  name: string;
  args: Record<string, unknown>;
}

// Normalized message for building conversation history across providers
export interface NormalizedMessage {
  role: "user" | "assistant";
  text: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
}

// Provider-agnostic LLM client interface
export interface LLMClient {
  // Simple generation: system + user prompt, optional file attachments
  generate(system: string, user: string, files: File[]): Promise<{ text: string; usage?: MessageUsage }>;

  // Agent streaming with tool support
  streamAgent(
    history: NormalizedMessage[],
    userText: string,
    files: File[],
    onText: (delta: string) => void,
    onThinking: (delta: string) => void,
    onToolCall: (call: NormalizedToolCall) => Promise<unknown>,
  ): Promise<MessageUsage | undefined>;
}
