import { createNote, createNoteFunctionDeclaration } from "src/backend/tools/obsidian/obsCreate";
import { editNote, editNoteFunctionDeclaration } from "src/backend/tools/obsidian/obsEdit";
import { readNote, readNoteFunctionDeclaration } from "src/backend/tools/obsidian/obsRead";
import { createDir, createDirFunctionDeclaration } from "src/backend/tools/obsidian/obsDir";
import { noteFiltering, noteFilteringFunctionDeclaration } from "src/backend/tools/obsidian/obsFilter";
import { listFiles, listFilesFunctionDeclaration } from "src/backend/tools/obsidian/obsListing";
import { vaultSearch, vaultSearchFunctionDeclaration } from "src/backend/tools/obsidian/obsSearch";
import { webSearch, webSearchFunctionDeclaration } from "src/backend/tools/webSearch";
import { moveNote, moveNoteFunctionDeclaration, moveFolder, moveFolderFunctionDeclaration } from "src/backend/tools/obsidian/obsMove";
import { deleteNote, deleteNoteFunctionDeclaration, deleteFolder, deleteFolderFunctionDeclaration } from "src/backend/tools/obsidian/obsDelete";

// Provider-agnostic function call descriptor
interface FunctionCallDescriptor {
  name?: string;
  args?: Record<string, unknown>;
}


export const callableFunctionDeclarations = [
  createNoteFunctionDeclaration,
  editNoteFunctionDeclaration,
  readNoteFunctionDeclaration,
  createDirFunctionDeclaration,
  noteFilteringFunctionDeclaration,
  listFilesFunctionDeclaration,
  vaultSearchFunctionDeclaration,
  webSearchFunctionDeclaration,
  moveNoteFunctionDeclaration,
  moveFolderFunctionDeclaration,
  deleteNoteFunctionDeclaration,
  deleteFolderFunctionDeclaration,
]

export async function executeFunction(funcCall: FunctionCallDescriptor) {
  let response;
  switch (funcCall.name) {
    case "web_search":
      response = await webSearch(
        funcCall.args!.query as string
      );
      break;

    case "create_note":
      response = await createNote(
        funcCall.args!.topic as string,
        funcCall.args!.name as string,
        funcCall.args!.tags as string[],
        funcCall.args!.context as string,
        funcCall.args!.dirPath as string,
        funcCall.args!.content as string,
        funcCall.args!.useLlm as boolean,
      );
      break;

    case "edit_note":
      response = await editNote(
        funcCall.args!.fileName as string,
        funcCall.args!.activeNote as boolean,
        funcCall.args!.newContent as string,
        funcCall.args!.useLlm as boolean,
        funcCall.args!.tags as string[],
        funcCall.args!.context as string,
      );
      break;

    case "read_note":
      response = await readNote(
        funcCall.args!.fileName as string,
        funcCall.args!.activeNote as boolean,
      );
      break;
    
    case "create_directory":
      response = await createDir(
        funcCall.args!.name as string,
        funcCall.args!.dirPath as string,
      );
      break;

    case "filter_notes":
      response = await noteFiltering(
        funcCall.args!.field as string,
        funcCall.args!.dateRange as string | { start: number, end: number },
        funcCall.args!.limit as number,
        funcCall.args!.sortOrder as string,
      );
      break;

    case "list_files":
      response = await listFiles(
        funcCall.args!.dirPath as string,
        funcCall.args!.limit as number,
      );
      break;

    case "vault_search":
      response = await vaultSearch(
        funcCall.args!.name as string,
        funcCall.args!.isNote as boolean,
      );
      break;

    case "move_note":
      response = await moveNote(
        funcCall.args!.fileName as string,
        funcCall.args!.newPath as string,
      );
      break;

    case "move_folder":
      response = await moveFolder(
        funcCall.args!.dirPath as string,
        funcCall.args!.newPath as string,
      );
      break;

    case "delete_note":
      response = await deleteNote(
        funcCall.args!.fileName as string,
      );
      break;

    case "delete_folder":
      response = await deleteFolder(
        funcCall.args!.dirPath as string,
      );
      break;

    default:
      response = { response: `Function ${funcCall.name} not implemented.` };
  };

  return response;
}
