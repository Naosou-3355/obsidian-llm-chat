export interface Model {
  provider: "google" | "openai" | "anthropic" | "ollama",
  name: string,
  capabilities: Array<"vision" | "reasoning" | "websearch">,
  description: string,
}

