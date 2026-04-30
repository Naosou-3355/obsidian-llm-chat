import { getSettings } from "src/plugin";
import { createLLMClient } from "src/backend/managers/providers/factory";


// Function that calls the llm model without chat history and tools
export async function callModel(
  system: string,
  user: string,
  files: File[],
): Promise<string> {
  const settings = getSettings();
  const client = createLLMClient(settings);
  const { text } = await client.generate(system, user, files);
  return text;
}
