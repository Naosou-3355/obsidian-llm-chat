import { Type } from "@google/genai";
import { TFile, TFolder } from "obsidian";
import { getApp, getSettings } from "src/plugin";
import { findClosestFile } from "src/utils/notes/searching";


export const deleteNoteFunctionDeclaration = {
  name: "delete_note",
  description: "Move a note to the system trash. Use vault_search first if unsure of the exact path. Always confirm with the user before deleting.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: {
        type: Type.STRING,
        description: "The name or path of the note to delete (without .md extension)",
      },
    },
    required: ["fileName"],
  },
};

export async function deleteNote(fileName: string) {
  const app = getApp();
  const settings = getSettings();

  const file = findClosestFile(fileName);
  if (!file) {
    return { success: false, response: `Could not find a note matching "${fileName}".` };
  }

  if (!(file instanceof TFile)) {
    return { success: false, response: `"${fileName}" is not a file.` };
  }

  try {
    await app.vault.trash(file, true);
    return { success: true, response: `Moved "${file.path}" to trash.` };
  } catch (err) {
    if (settings.debug) console.error(err);
    return { success: false, response: err instanceof Error ? err.message : "Unknown error" };
  }
}


export const deleteFolderFunctionDeclaration = {
  name: "delete_folder",
  description: "Move a folder and all its contents to the system trash. Always confirm with the user before deleting.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dirPath: {
        type: Type.STRING,
        description: "Path of the folder to delete, e.g. 'Projects/OldFolder'",
      },
    },
    required: ["dirPath"],
  },
};

export async function deleteFolder(dirPath: string) {
  const app = getApp();
  const settings = getSettings();

  const folder = app.vault.getFolderByPath(dirPath);
  if (!folder) {
    return { success: false, response: `Could not find folder "${dirPath}".` };
  }

  if (!(folder instanceof TFolder)) {
    return { success: false, response: `"${dirPath}" is not a folder.` };
  }

  try {
    await app.vault.trash(folder, true);
    return { success: true, response: `Moved folder "${dirPath}" and its contents to trash.` };
  } catch (err) {
    if (settings.debug) console.error(err);
    return { success: false, response: err instanceof Error ? err.message : "Unknown error" };
  }
}
