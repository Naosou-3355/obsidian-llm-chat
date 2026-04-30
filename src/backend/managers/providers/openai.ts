import OpenAI from "openai";
import { AgentSettings } from "src/settings/SettingsTab";
import { MessageUsage } from "src/types/chat";
import { LLMClient, NormalizedMessage, NormalizedToolCall } from "src/backend/managers/llmClient";
import { callableFunctionDeclarations } from "src/backend/managers/functionRunner";
import { agentSystemPrompt } from "src/backend/managers/prompts/library";
import { imageToBase64 } from "src/utils/parsing/imageBase64";


function getClient(settings: AgentSettings, baseURL?: string): OpenAI {
  // Ollama accepts any non-empty string as the API key; fall back to "ollama" when
  // a custom baseURL is set (Ollama) and no OpenAI key has been provided.
  const apiKey = settings.openaiApiKey || (baseURL ? "ollama" : "");
  return new OpenAI({
    apiKey,
    baseURL: baseURL ?? undefined,
    dangerouslyAllowBrowser: true,
  });
}

function getTools(): OpenAI.Chat.ChatCompletionTool[] {
  return callableFunctionDeclarations.map((decl: any) => ({
    type: "function" as const,
    function: {
      name: decl.name,
      description: decl.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(decl.parameters?.properties ?? {}).map(([k, v]: [string, any]) => [
            k,
            {
              type: (v.type as string).toLowerCase(),
              description: v.description,
              ...(v.items ? { items: { type: (v.items.type as string).toLowerCase() } } : {}),
            },
          ])
        ),
        required: decl.parameters?.required ?? [],
      },
    },
  }));
}

function buildMessages(
  history: NormalizedMessage[],
  userText: string,
  systemPrompt: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of history) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [{ id: tc.name, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.args) } }],
        } as OpenAI.Chat.ChatCompletionMessageParam);
        messages.push({
          role: "tool",
          content: JSON.stringify(tc.result),
          tool_call_id: tc.name,
        });
      }
      if (msg.text.trim()) {
        messages.push({ role: "assistant", content: msg.text });
      }
    } else {
      messages.push({ role: msg.role, content: msg.text });
    }
  }
  messages.push({ role: "user", content: userText });
  return messages;
}

async function filesToContent(files: File[]): Promise<string> {
  if (files.length === 0) return "";
  // Append base64 images as data URLs in the user message for vision models
  const parts: string[] = [];
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const b64 = await imageToBase64(file);
      parts.push(`[Image: ${file.name}]\n${b64}`);
    }
  }
  return parts.length > 0 ? "\n" + parts.join("\n") : "";
}


export class OpenAIProvider implements LLMClient {
  private settings: AgentSettings;
  private baseURL?: string;

  constructor(settings: AgentSettings, baseURL?: string) {
    this.settings = settings;
    this.baseURL = baseURL;
  }

  async generate(system: string, user: string, files: File[]): Promise<{ text: string; usage?: MessageUsage }> {
    const client = getClient(this.settings, this.baseURL);
    const fileContent = await filesToContent(files);

    const response = await client.chat.completions.create({
      model: this.settings.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user + fileContent },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const usage: MessageUsage | undefined = response.usage
      ? {
          model: this.settings.model,
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined;

    return { text, usage };
  }

  async streamAgent(
    history: NormalizedMessage[],
    userText: string,
    files: File[],
    onText: (delta: string) => void,
    onThinking: (delta: string) => void,
    onToolCall: (call: NormalizedToolCall) => Promise<unknown>,
  ): Promise<MessageUsage | undefined> {
    const client = getClient(this.settings, this.baseURL);
    const fileContent = await filesToContent(files);
    const tools = getTools();

    const messages = buildMessages(history, userText + fileContent, agentSystemPrompt);

    return await this._agentLoop(client, messages, tools, onText, onToolCall, 0);
  }

  private async _agentLoop(
    client: OpenAI,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.ChatCompletionTool[],
    onText: (delta: string) => void,
    onToolCall: (call: NormalizedToolCall) => Promise<unknown>,
    depth: number,
  ): Promise<MessageUsage | undefined> {
    if (depth > 5) throw new Error("Maximum tool execution depth reached.");

    const stream = await client.chat.completions.create({
      model: this.settings.model,
      messages,
      tools,
      stream: true,
      // stream_options is OpenAI-specific; Ollama (custom baseURL) doesn't support it
      ...(this.baseURL ? {} : { stream_options: { include_usage: true } }),
    });

    let accText = "";
    let accToolName = "";
    let accToolArgs = "";
    let toolCallId = "";
    let usage: OpenAI.CompletionUsage | undefined;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        accText += delta.content;
        onText(delta.content);
      }
      if (delta?.tool_calls?.[0]) {
        const tc = delta.tool_calls[0];
        if (tc.id) toolCallId = tc.id;
        if (tc.function?.name) accToolName += tc.function.name;
        if (tc.function?.arguments) accToolArgs += tc.function.arguments;
      }
      if (chunk.usage) usage = chunk.usage;
    }

    if (accToolName) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(accToolArgs); } catch { /* leave empty */ }

      const result = await onToolCall({ name: accToolName, args });

      const updatedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...messages,
        {
          role: "assistant",
          content: accText || null,
          tool_calls: [{ id: toolCallId || accToolName, type: "function", function: { name: accToolName, arguments: accToolArgs } }],
        } as OpenAI.Chat.ChatCompletionMessageParam,
        {
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCallId || accToolName,
        },
      ];

      return await this._agentLoop(client, updatedMessages, tools, onText, onToolCall, depth + 1);
    }

    if (usage) {
      return {
        model: this.settings.model,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
      };
    }
    return undefined;
  }
}
