import Anthropic from "@anthropic-ai/sdk";
import { AgentSettings } from "src/settings/SettingsTab";
import { MessageUsage } from "src/types/chat";
import { LLMClient, NormalizedMessage, NormalizedToolCall } from "src/backend/managers/llmClient";
import { callableFunctionDeclarations } from "src/backend/managers/functionRunner";
import { agentSystemPrompt } from "src/backend/managers/prompts/library";
import { imageToBase64 } from "src/utils/parsing/imageBase64";
import { allAvailableModels } from "src/settings/models";


function getClient(settings: AgentSettings): Anthropic {
  return new Anthropic({
    apiKey: settings.anthropicApiKey,
    dangerouslyAllowBrowser: true,
  });
}

function supportsThinking(modelName: string): boolean {
  const modelDef = allAvailableModels.find(m => m.name === modelName);
  return modelDef?.capabilities.includes("reasoning") ?? false;
}

function getTools(): Anthropic.Messages.Tool[] {
  return callableFunctionDeclarations.map((decl: any) => ({
    name: decl.name,
    description: decl.description,
    input_schema: {
      type: "object" as const,
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
  }));
}

function buildMessages(history: NormalizedMessage[]): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];

  for (const msg of history) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const toolUseContent = msg.toolCalls.map((tc) => ({
        type: "tool_use" as const,
        id: tc.name,
        name: tc.name,
        input: tc.args,
      })) as Anthropic.Messages.ToolUseBlock[];
      messages.push({ role: "assistant", content: toolUseContent });

      const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = msg.toolCalls.map((tc) => ({
        type: "tool_result" as const,
        tool_use_id: tc.name,
        content: JSON.stringify(tc.result),
      }));
      messages.push({ role: "user", content: toolResultContent });

      if (msg.text.trim()) {
        messages.push({ role: "assistant", content: msg.text });
      }
    } else {
      messages.push({ role: msg.role, content: msg.text });
    }
  }
  return messages;
}

async function filesToContentBlocks(files: File[]): Promise<Anthropic.Messages.ContentBlockParam[]> {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const b64 = await imageToBase64(file);
      const data = b64.replace(/^data:.*;base64,/, "");
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data,
        },
      });
    }
  }
  return blocks;
}

function enrichAnthropicError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|authentication_error|invalid x-api-key/i.test(msg)) return new Error("Anthropic API key is invalid or missing.");
  if (/429|rate.?limit/i.test(msg)) return new Error("Anthropic rate limit exceeded. Please wait and retry.");
  if (/credit\s+balance|credit_balance_insufficient/i.test(msg)) return new Error(`Anthropic error: ${msg}`);
  return new Error(`Anthropic error: ${msg}`);
}


export class AnthropicProvider implements LLMClient {
  private settings: AgentSettings;

  constructor(settings: AgentSettings) {
    this.settings = settings;
  }

  async generate(system: string, user: string, files: File[]): Promise<{ text: string; usage?: MessageUsage }> {
    try {
      const client = getClient(this.settings);
      const imageBlocks = await filesToContentBlocks(files);

      const userContent: Anthropic.Messages.ContentBlockParam[] = [
        ...imageBlocks,
        { type: "text", text: user },
      ];

      const useThinking = supportsThinking(this.settings.model);
      const response = await client.messages.create({
        model: this.settings.model,
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: userContent }],
        ...(useThinking ? { thinking: { type: "enabled" as const, budget_tokens: 10000 } } : {}),
      });

      const text = response.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.Messages.TextBlock).text).join("");
      const usage: MessageUsage = {
        model: this.settings.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };

      return { text, usage };
    } catch (err) {
      throw enrichAnthropicError(err);
    }
  }

  async streamAgent(
    history: NormalizedMessage[],
    userText: string,
    files: File[],
    onText: (delta: string) => void,
    onThinking: (delta: string) => void,
    onToolCall: (call: NormalizedToolCall) => Promise<unknown>,
  ): Promise<MessageUsage | undefined> {
    const client = getClient(this.settings);
    const imageBlocks = await filesToContentBlocks(files);

    const userContent: Anthropic.Messages.ContentBlockParam[] = [
      ...imageBlocks,
      { type: "text", text: userText },
    ];

    const messages = buildMessages(history);
    messages.push({ role: "user", content: userContent });

    return await this._agentLoop(client, messages, onText, onThinking, onToolCall, 0);
  }

  private async _agentLoop(
    client: Anthropic,
    messages: Anthropic.Messages.MessageParam[],
    onText: (delta: string) => void,
    onThinking: (delta: string) => void,
    onToolCall: (call: NormalizedToolCall) => Promise<unknown>,
    depth: number,
  ): Promise<MessageUsage | undefined> {
    if (depth > 5) throw new Error("Maximum tool execution depth reached.");

    const tools = getTools();
    const useThinking = supportsThinking(this.settings.model);

    const stream = client.messages.stream({
      model: this.settings.model,
      max_tokens: 16384,
      system: agentSystemPrompt,
      messages,
      tools,
      ...(useThinking ? { thinking: { type: "enabled" as const, budget_tokens: 10000 } } : {}),
    });

    let pendingToolUse: { id: string; name: string; input: string } | undefined;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "thinking_delta") {
            onThinking(event.delta.thinking);
          } else if (event.delta.type === "text_delta") {
            onText(event.delta.text);
          } else if (event.delta.type === "input_json_delta" && pendingToolUse) {
            pendingToolUse.input += event.delta.partial_json;
          }
        } else if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            pendingToolUse = { id: event.content_block.id, name: event.content_block.name, input: "" };
          }
        } else if (event.type === "message_delta") {
          if (event.usage) {
            outputTokens = event.usage.output_tokens;
          }
        } else if (event.type === "message_start") {
          inputTokens = event.message.usage.input_tokens;
        }
      }
    } catch (err) {
      throw enrichAnthropicError(err);
    }

    const finalMessage = await stream.finalMessage().catch(err => {
      throw new Error(`Anthropic failed to finalize response: ${err instanceof Error ? err.message : String(err)}`);
    });

    if (pendingToolUse) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(pendingToolUse.input || "{}"); } catch { /* leave empty */ }

      const result = await onToolCall({ name: pendingToolUse.name, args });

      const assistantContent = finalMessage.content;
      const toolResultMessage: Anthropic.Messages.MessageParam = {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: pendingToolUse.id,
          content: JSON.stringify(result),
        }],
      };

      return await this._agentLoop(
        client,
        [...messages, { role: "assistant", content: assistantContent }, toolResultMessage],
        onText, onThinking, onToolCall, depth + 1,
      );
    }

    return {
      model: this.settings.model,
      inputTokens,
      outputTokens,
    };
  }
}
