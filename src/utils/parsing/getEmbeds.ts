import { TFile, arrayBufferToBase64 } from "obsidian";
import { getApp } from "src/plugin";


// Return File objects for every embedded image in a note (works on desktop and mobile)
export async function getEmbeds(file: TFile): Promise<File[]> {
  if (file.extension !== "md") return [];

  const app = getApp();
  const meta = app.metadataCache.getFileCache(file);
  const embeddedFiles = meta?.embeds?.map((embed) => embed.link);

  if (!embeddedFiles || embeddedFiles.length === 0) return [];

  const images: File[] = [];

  for (const embedFile of embeddedFiles) {
    if (
      !embedFile.endsWith(".png") &&
      !embedFile.endsWith(".jpg") &&
      !embedFile.endsWith(".jpeg")
    ) {
      continue;
    }

    try {
      const match = app.vault
        .getFiles()
        .find((f) => f.extension !== "md" && f.name === embedFile);

      if (!match) continue;

      const arrayBuffer = await app.vault.readBinary(match);

      const mimeType = match.extension === "png" ? "image/png" : "image/jpeg";

      const base64 = arrayBufferToBase64(arrayBuffer);
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const fileObj = new File([bytes], match.name, { type: mimeType });
      images.push(fileObj);
    } catch (error) {
      console.error("Error reading embedded file:", error);
    }
  }

  return images;
}
