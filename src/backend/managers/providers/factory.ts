import { AgentSettings } from "src/settings/SettingsTab";
import { LLMClient } from "src/backend/managers/llmClient";
import { GeminiProvider } from "src/backend/managers/providers/gemini";
import { OpenAIProvider } from "src/backend/managers/providers/openai";
import { AnthropicProvider } from "src/backend/managers/providers/anthropic";


export function createLLMClient(settings: AgentSettings): LLMClient {
  switch (settings.provider) {
    case "openai":
      return new OpenAIProvider(settings);
    case "anthropic":
      return new AnthropicProvider(settings);
    case "ollama":
      return new OpenAIProvider(settings, settings.ollamaEndpoint || "http://localhost:11434/v1");
    default:
      return new GeminiProvider(settings);
  }
}
