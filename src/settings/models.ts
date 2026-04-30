import { Model } from "src/types/ai";

// Available models
export const allAvailableModels: Model[] = [
  // Google Gemini
  {
    provider: "google",
    name: "gemini-2.0-flash",
    capabilities: ["vision", "websearch"],
    description: "Second generation workhorse model, with a 1 million token context window.",
  },
  {
    provider: "google",
    name: "gemini-2.5-flash",
    capabilities: ["vision", "websearch"],
    description: "Best model in terms of price-performance, offering well-rounded capabilities. 2.5 Flash is best for large scale processing, low-latency, high volume tasks that require thinking, and agentic use cases.",
  },
  {
    provider: "google",
    name: "gemini-2.5-flash-lite",
    capabilities: ["vision", "websearch"],
    description: "Fastest flash model optimized for cost-efficiency and high throughput.",
  },
  {
    provider: "google",
    name: "gemini-2.5-pro",
    capabilities: ["vision", "websearch"],
    description: "State-of-the-art thinking model, capable of reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context.",
  },
  {
    provider: "google",
    name: "gemini-3-flash-preview",
    capabilities: ["vision", "websearch"],
    description: "The best model in the world for multimodal understanding, and our most powerful agentic and vibe-coding model yet, delivering richer visuals and deeper interactivity, all built on a foundation of state-of-the-art reasoning.",
  },
  {
    provider: "google",
    name: "gemini-3.1-flash-lite-preview",
    capabilities: ["vision", "websearch"],
    description: "Google's most cost-efficient multimodal model, offering the fastest performance for high-frequency, lightweight tasks.",
  },
  {
    provider: "google",
    name: "gemini-3.1-pro-preview",
    capabilities: ["vision", "websearch"],
    description: "Built to refine the performance and reliability of the Gemini 3 Pro series. Optimized for software engineering behavior and agentic workflows.",
  },

  // OpenAI
  {
    provider: "openai",
    name: "gpt-4o",
    capabilities: ["vision"],
    description: "OpenAI's flagship multimodal model. Fast, intelligent, and supports vision.",
  },
  {
    provider: "openai",
    name: "gpt-4o-mini",
    capabilities: ["vision"],
    description: "Smaller, faster, and more affordable version of GPT-4o.",
  },
  {
    provider: "openai",
    name: "o3-mini",
    capabilities: ["reasoning"],
    description: "OpenAI's fast reasoning model optimized for STEM tasks.",
  },

  // Anthropic Claude
  {
    provider: "anthropic",
    name: "claude-opus-4-7",
    capabilities: ["vision", "reasoning"],
    description: "Anthropic's most capable model. Best for complex analysis, nuanced writing, and advanced reasoning.",
  },
  {
    provider: "anthropic",
    name: "claude-sonnet-4-6",
    capabilities: ["vision", "reasoning"],
    description: "Ideal balance of intelligence and speed. Great for most tasks.",
  },
  {
    provider: "anthropic",
    name: "claude-haiku-4-5",
    capabilities: ["vision"],
    description: "Anthropic's fastest and most compact model for near-instant responses.",
  },

  // Ollama (local)
  {
    provider: "ollama",
    name: "llama3.2",
    capabilities: [],
    description: "Meta's Llama 3.2 running locally via Ollama. Change the model name in settings to use any installed Ollama model.",
  },
];
