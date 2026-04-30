import { Type } from "@google/genai";
import { TAbstractFile } from "obsidian";
import { getApp, getSettings } from "src/plugin";
import { findClosestFile } from "src/utils/notes/searching";
import { findMatchingFolder } from "src/utils/notes/searching";


export const moveNoteFunctionDeclaration = {
  name: "move_note",
  description: "Move a note to a different folder, rename it, or both. Provide the note name and the full new path (folder + filename). Use vault_search first if unsure of the exact path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: {
        type: Type.STRING,
        description: "The current name or path of the note to move (without .md extension)",
      },
      newPath: {
        type: Type.STRING,
        description: "The full new path including filename with .md extension, e.g. 'Folder/Subfolder/NewName.md'",
      },
    },
    required: ["fileName", "newPath"],
  },
};

export async function moveNote(
  fileName: string,
  newPath: string,
) {
  const app = getApp();
  const settings = getSettings();

  const file = findClosestFile(fileName);
  if (!file) {
    return { success: false, response: `Could not find a note matching "${fileName}".` };
  }

  // Sanitize destination path
  newPath = newPath.replace(/\.\.\//g, "").replace(/\.\.$/, "");
  if (!newPath.endsWith(".md")) newPath += ".md";

  // Check destination doesn't already exist
  if (app.vault.getAbstractFileByPath(newPath)) {
    return { success: false, response: `A file already exists at "${newPath}". Choose a different name or path.` };
  }

  try {
    await app.vault.rename(file, newPath);
    return { success: true, response: `Moved "${file.path}" → "${newPath}".` };
  } catch (err) {
    if (settings.debug) console.error(err);
    return { success: false, response: err instanceof Error ? err.message : "Unknown error" };
  }
}


export const moveFolderFunctionDeclaration = {
  name: "move_folder",
  description: "Move or rename a folder. Provide the current folder path and the full new path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dirPath: {
        type: Type.STRING,
        description: "Current folder path, e.g. 'Projects/OldName'",
      },
      newPath: {
        type: Type.STRING,
        description: "New folder path, e.g. 'Archive/OldName' or 'Projects/NewName'",
      },
    },
    required: ["dirPath", "newPath"],
  },
};

export async function moveFolder(
  dirPath: string,
  newPath: string,
) {
  const app = getApp();
  const settings = getSettings();

  const folder = app.vault.getFolderByPath(dirPath);
  if (!folder) {
    return { success: false, response: `Could not find folder "${dirPath}".` };
  }

  newPath = newPath.replace(/\.\.\//g, "").replace(/\.\.$/, "").replace(/^\/+|\/+$/g, "");

  if (app.vault.getAbstractFileByPath(newPath)) {
    return { success: false, response: `A folder or file already exists at "${newPath}".` };
  }

  try {
    await app.vault.rename(folder, newPath);
    return { success: true, response: `Moved folder "${dirPath}" → "${newPath}".` };
  } catch (err) {
    if (settings.debug) console.error(err);
    return { success: false, response: err instanceof Error ? err.message : "Unknown error" };
  }
}
