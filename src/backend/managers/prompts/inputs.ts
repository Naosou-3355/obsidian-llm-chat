import { Content, Part } from "@google/genai";
import { getSettings } from "src/plugin";
import { imageToBase64 } from "src/utils/parsing/imageBase64";
import { Message } from "src/types/chat";
import { NormalizedMessage } from "src/backend/managers/llmClient";


// Function that prepare the prompt into inputs for the agent
// This function only manages text and files, function calls are not handled here
// Look how to handle function calls in buildChatHistory
export async function prepareModelInputs(
  user: string,
  files: File[],
): Promise<Part[]> {
  const parts: Part[] = [{ text: user }];

  for (const file of files) {
    const base64 = await imageToBase64(file);

    parts.push({
      inlineData: {
        mimeType: file.type,
        data: base64.replace(/^data:.*;base64,/, ""), // Remove the data URL prefix
      },
    });
  };

  return parts;
}


// Function that builds the chat history
export async function buildChatHistory(
  conversation: Message[],
): Promise<Content[]> {
  const settings = getSettings();
  const maxHistoryTurns = settings.maxHistoryTurns;

  if (maxHistoryTurns === 0) return [];

  const chatHistory: Content[] = [];
  let selectedMessages: Message[] = conversation.slice(-maxHistoryTurns*2);
  // Reverse to process the messages in the order they were sent
  selectedMessages = selectedMessages.reverse(); 

  for (const message of selectedMessages) {
    if (message.sender === "error") continue;

    // We need to include the function response (user) and the function call (model)
    // Per tool call made by the model
    if (message.toolCalls.length > 0) {
      for (const funcCall of message.toolCalls) {
        const modelFunctionCall: Part[] = [{
          functionCall: {
            name: funcCall.name,
            args: funcCall.args,
          }
        }];
        chatHistory.push({
          role: "model",
          parts: modelFunctionCall,
        });

        const userFunctionResponse: Part[] = [{
          functionResponse: {
            name: funcCall.name,
            response: funcCall.response
          }
        }]
        chatHistory.push({
          role: "user",
          parts: userFunctionResponse,
        });
      }

      if (message.content.trim().length > 0) {
        const modelFinalAnswer: Part[] = [{
          text: message.content,
        }]
        chatHistory.push({
          role: "model",
          parts: modelFinalAnswer,
        });
      }
    } else {
      const parts: Part[] = await prepareModelInputs(message.content, []);
      chatHistory.push({
        role: message.sender === "user" ? "user" : "model",   
        parts: parts,
      });
    }
  };
  
  // Reverse back to original order
  chatHistory.reverse();

  return chatHistory;
}


// Build a provider-agnostic conversation history from stored messages
export function buildNormalizedHistory(conversation: Message[]): NormalizedMessage[] {
  const settings = getSettings();
  const maxTurns = settings.maxHistoryTurns;
  if (maxTurns === 0) return [];

  const selected = conversation.slice(-maxTurns * 2).reverse();
  const result: NormalizedMessage[] = [];

  for (const msg of selected) {
    if (msg.sender === "error") continue;

    if (msg.toolCalls.length > 0) {
      result.push({
        role: "assistant",
        text: msg.content,
        toolCalls: msg.toolCalls.map((tc) => ({
          name: tc.name,
          args: tc.args ?? {},
          result: tc.response ?? {},
        })),
      });
    } else {
      result.push({
        role: msg.sender === "user" ? "user" : "assistant",
        text: msg.content,
      });
    }
  }

  result.reverse();
  return result;
}
