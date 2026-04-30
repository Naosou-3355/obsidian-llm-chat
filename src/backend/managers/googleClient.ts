import {
  GoogleGenAI,
  GoogleGenAIOptions,
  GenerateContentConfig,
  SafetySetting, 
  HarmCategory, 
  HarmBlockThreshold,
  ThinkingLevel,
} from "@google/genai";
import { getSettings } from "src/plugin";
import { agentSystemPrompt } from "src/backend/managers/prompts/library";  
import { callableFunctionDeclarations } from "src/backend/managers/functionRunner";
import { DEFAULT_SETTINGS } from "src/settings/SettingsTab";

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

export async function createGoogleClient(system: string | undefined = undefined) {
  const settings = getSettings();

  // Initialize model and its configuration
  const baseUrl = validateBaseUrl(settings.baseUrl);
  
  const config: GoogleGenAIOptions = { 
    apiKey: settings.googleApiKey, 
    apiVersion: "v1beta", 
    httpOptions: { baseUrl: baseUrl }
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
    systemInstruction: system ? system : agentSystemPrompt,
    safetySettings: safetySettings,
    thinkingConfig: {
      includeThoughts: true,
    },
  };

  // Agent function declarations
  if (!system) {
    generationConfig.tools = [{ functionDeclarations: callableFunctionDeclarations }]
  }

  // Special settings for Gemini 3 models
  if (settings.model.includes("3") && settings.thinkingLevel !== DEFAULT_SETTINGS.thinkingLevel) {
    generationConfig.thinkingConfig!.thinkingLevel = settings.thinkingLevel === "Low" 
      ? ThinkingLevel.LOW 
      : ThinkingLevel.HIGH;
  }
  if (settings.temperature !== DEFAULT_SETTINGS.temperature) {
    generationConfig.temperature = Number(settings.temperature);
  }
  if (settings.maxOutputTokens !== DEFAULT_SETTINGS.maxOutputTokens) {
    generationConfig.maxOutputTokens = Number(settings.maxOutputTokens);
  }

  return {
    ai,
    generationConfig,
  };
}