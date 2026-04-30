import {
  GoogleGenAI,
  GenerateContentConfig,
  GenerateContentResponse,
  Chat,
  Content,
  Part,
  ApiError,
} from "@google/genai";
import { AgentSettings } from "src/settings/SettingsTab";
import { DEFAULT_SETTINGS } from "src/settings/SettingsTab";
import { MessageUsage } from "src/types/chat";
import { LLMClient, NormalizedMessage, NormalizedToolCall } from "src/backend/managers/llmClient";
import { callableFunctionDeclarations } from "src/backend/managers/functionRunner";
import { agentSystemPrompt } from "src/backend/managers/prompts/library";
import { prepareModelInputs } from "src/backend/managers/prompts/inputs";
import {
  SafetySetting,
  HarmCategory,
  HarmBlockThreshold,
  ThinkingLevel,
  GoogleGenAIOptions,
} from "@google/genai";


function validateBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "https://generativelanguage.googleapis.com";
  try {
    const parsed = new URL(trimmed);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw new Error(`URL must use http or https protocol.`);
    }
  } catch {
    throw new Error(`Invalid base URL "${trimmed}". Please enter a valid HTTP(S) URL or leave blank for the default.`);
  }
  return trimmed;
}

function buildConfig(settings: AgentSettings, system?: string): { ai: GoogleGenAI; generationConfig: GenerateContentConfig } {
  const baseUrl = validateBaseUrl(settings.baseUrl);

  const config: GoogleGenAIOptions = {
    apiKey: settings.googleApiKey,
    apiVersion: "v1beta",
    httpOptions: { baseUrl },
  };
  const ai = new GoogleGenAI(config);

  const safetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  const generationConfig: GenerateContentConfig = {
    systemInstruction: system ?? agentSystemPrompt,
    safetySettings,
    thinkingConfig: { includeThoughts: true },
  };

  if (!system) {
    generationConfig.tools = [{ functionDeclarations: callableFunctionDeclarations }];
  }

  if (settings.model.includes("3") && settings.thinkingLevel !== DEFAULT_SETTINGS.thinkingLevel) {
    generationConfig.thinkingConfig!.thinkingLevel =
      settings.thinkingLevel === "Low" ? ThinkingLevel.LOW : ThinkingLevel.HIGH;
  }
  if (settings.temperature !== DEFAULT_SETTINGS.temperature) {
    generationConfig.temperature = Number(settings.temperature);
  }
  if (settings.maxOutputTokens !== DEFAULT_SETTINGS.maxOutputTokens) {
    generationConfig.maxOutputTokens = Number(settings.maxOutputTokens);
  }

  return { ai, generationConfig };
}

function buildGeminiHistory(history: NormalizedMessage[]): Content[] {
  const contents: Content[] = [];
  for (const msg of history) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        contents.push({
          role: "model",
          parts: [{ functionCall: { name: tc.name, args: tc.args } }],
        });
        contents.push({
          role: "user",
          parts: [{ functionResponse: { name: tc.name, response: tc.result as Record<string, unknown> } }],
        });
      }
      if (msg.text.trim()) {
        contents.push({ role: "model", parts: [{ text: msg.text }] });
      }
    } else {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      });
    }
  }
  return contents;
}


export class GeminiProvider implements LLMClient {
  private settings: AgentSettings;

  constructor(settings: AgentSettings) {
    this.settings = settings;
  }

  async generate(system: string, user: string, files: File[]): Promise<{ text: string; usage?: MessageUsage }> {
    const { ai, generationConfig } = buildConfig(this.settings, system);
    const inputs: Part[] = await prepareModelInputs(user, files);

    let response: GenerateContentResponse | undefined;
    try {
      response = await ai.models.generateContent({
        model: this.settings.model,
        contents: inputs,
        config: generationConfig,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) throw new Error("API key not set, or isn't valid.");
        if (error.status === 429) throw new Error("API quota exceeded. Please check your Google Cloud account.");
        if (error.status === 503) throw new Error("API service overloaded. Please try again later.");
        throw new Error(`API Error: ${error.message}`);
      }
      throw new Error(`Unexpected Error: ${String(error)}`);
    }

    if (!response) throw new Error("No message generated.");

    const meta = response.usageMetadata;
    const usage: MessageUsage | undefined = meta
      ? {
          model: this.settings.model,
          inputTokens: meta.promptTokenCount ?? 0,
          outputTokens: meta.candidatesTokenCount ?? 0,
          thinkingTokens: meta.thoughtsTokenCount ?? undefined,
        }
      : undefined;

    return { text: response.text || "", usage };
  }

  async streamAgent(
    history: NormalizedMessage[],
    userText: string,
    files: File[],
    onText: (delta: string) => void,
    onThinking: (delta: string) => void,
    onToolCall: (call: NormalizedToolCall) => Promise<unknown>,
  ): Promise<MessageUsage | undefined> {
    const { ai, generationConfig } = buildConfig(this.settings);
    const chatHistory = buildGeminiHistory(history);

    const chat: Chat = ai.chats.create({
      model: this.settings.model,
      history: chatHistory,
      config: generationConfig,
    });

    const input: Part[] = await prepareModelInputs(userText, files);
    const executedFunctionIds = new Set<string>();

    return await this._streamTurn(1, ai, generationConfig, chat, chatHistory, input, onText, onThinking, onToolCall, executedFunctionIds);
  }

  private async _streamTurn(
    turn: number,
    ai: GoogleGenAI,
    generationConfig: GenerateContentConfig,
    chat: Chat,
    originalHistory: Content[],
    input: Part[],
    onText: (delta: string) => void,
    onThinking: (delta: string) => void,
    onToolCall: (call: NormalizedToolCall) => Promise<unknown>,
    executedFunctionIds: Set<string>,
  ): Promise<MessageUsage | undefined> {
    if (turn > 5) {
      throw new Error("Maximum tool execution depth reached.");
    }

    try {
      const stream = await chat.sendMessageStream({ message: input });
      let fcCandidate: { name: string; args: Record<string, unknown>; modelContent: Content } | undefined;

      for await (const chunk of stream) {
        for (const cand of chunk.candidates ?? []) {
          for (const part of cand.content?.parts ?? []) {
            if (part.thought && part.text) onThinking(part.text);
          }
        }

        onText(chunk.text || "");

        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          const fc = chunk.functionCalls[0];
          if (!fc.name) continue;
          const fId = fc.name + JSON.stringify(fc.args || {});
          if (executedFunctionIds.has(fId)) continue;
          executedFunctionIds.add(fId);

          const modelContent = chunk.candidates?.[0]?.content as Content;
          fcCandidate = { name: fc.name, args: (fc.args ?? {}) as Record<string, unknown>, modelContent };
        }
      }

      if (fcCandidate) {
        const result = await onToolCall({ name: fcCandidate.name, args: fcCandidate.args });
        const functionResponsePart: Part = {
          functionResponse: { name: fcCandidate.name, response: result as Record<string, unknown> },
        };
        const userContent: Content = { role: "user", parts: input };
        const newHistory: Content[] = [...originalHistory, userContent, fcCandidate.modelContent];
        const newChat: Chat = ai.chats.create({
          model: this.settings.model,
          history: newHistory,
          config: generationConfig,
        });
        return await this._streamTurn(
          turn + 1, ai, generationConfig, newChat, newHistory,
          [functionResponsePart], onText, onThinking, onToolCall, executedFunctionIds,
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalResponse = await (stream as any).response;
      const meta = finalResponse?.usageMetadata;
      if (meta) {
        return {
          model: this.settings.model,
          inputTokens: meta.promptTokenCount ?? 0,
          outputTokens: meta.candidatesTokenCount ?? 0,
          thinkingTokens: meta.thoughtsTokenCount ?? undefined,
        };
      }
      return undefined;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) throw new Error("API key not set, or isn't valid.");
        if (error.status === 429) throw new Error("API quota exceeded. Please check your Google Cloud account.");
        if (error.status === 503) throw new Error("API service overloaded. Please try again later.");
        throw new Error(`API Error: ${error.message}`);
      }
      throw new Error(`Unexpected Error: ${String(error)}`);
    }
  }
}
