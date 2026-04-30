import { getSettings } from "src/plugin";
import { Message, Attachment, ToolCall, MessageUsage } from "src/types/chat";
import { buildNormalizedHistory } from "src/backend/managers/prompts/inputs";
import { executeFunction } from "src/backend/managers/functionRunner";
import { createLLMClient } from "src/backend/managers/providers/factory";
import { NormalizedToolCall } from "src/backend/managers/llmClient";


// Function that calls the agent with chat history and tools binded
export async function callAgent(
  conversation: Message[],
  message: string,
  attachments: Attachment[],
  files: File[],
  updateAiMessage: (m: string, r: string, t: ToolCall[]) => void,
): Promise<MessageUsage | undefined> {
  const settings = getSettings();
  const client = createLLMClient(settings);

  // Build normalized history
  const history = buildNormalizedHistory(conversation);

  // Append attachment paths to the user message
  let fullUserMessage = message;
  if (attachments.length > 0) {
    fullUserMessage += `\n###\nAttached Obsidian notes: `;
    for (const note of attachments) {
      fullUserMessage += `\n${note.path}`;
    }
    fullUserMessage += `\n###\n`;
  }

  // Tool call dispatcher
  const onToolCall = async (call: NormalizedToolCall): Promise<unknown> => {
    const response = await executeFunction({ name: call.name, args: call.args });
    updateAiMessage("", "", [{
      name: call.name,
      args: call.args,
      response: response as Record<string, unknown>,
    }]);
    return response;
  };

  try {
    const usage = await client.streamAgent(
      history,
      fullUserMessage,
      files,
      (delta) => updateAiMessage(delta, "", []),
      (thinking) => updateAiMessage("", thinking, []),
      onToolCall,
    );
    return usage;
  } catch (error) {
    throw error;
  }
}
