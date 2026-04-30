<h1 align="center">Nao's LLM</h1>

<p align="center">
  Your personal AI assistant in Obsidian.<br/>
  Read, write, and search your vault with Gemini, OpenAI, Claude, or local Ollama models.
</p>

<div align="center">
  <img src="https://img.shields.io/badge/Obsidian-%23483699.svg?&logo=obsidian&logoColor=white" alt="Obsidian">
  <img src="https://img.shields.io/badge/Licence-MIT-D93192" alt="MIT Licence">
</div>

---

## Overview

Nao's LLM is a lightweight AI plugin for Obsidian. It connects an AI agent to your vault so you can chat naturally, delegate note tasks, and search your knowledge base — all without leaving the app.

**Supported providers:**
- Google Gemini (gemini-2.5-flash, gemini-2.5-pro, and more)
- OpenAI (gpt-4o, gpt-4o-mini, o3-mini)
- Anthropic Claude (claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5)
- Ollama (any locally running model)

## Getting Started

1. Clone the repository into your vault's plugins folder:
   ```
   ~/vault/.obsidian/plugins/naos-llm/
   ```
2. Enable the plugin in Obsidian Settings → Community Plugins.
3. Open plugin settings and enter the API key for your chosen provider (Gemini, OpenAI, or Anthropic). For Ollama, set the local endpoint URL.
4. Click the brain icon in the sidebar or press **Ctrl+N** (Cmd+N on Mac) to open the chat panel.

## Features

### Multi-provider AI
Switch between Gemini, OpenAI, Claude, and Ollama models from the model picker. Each provider's API key is stored separately in settings.

### Agent Tools
The AI agent can interact with your vault using these tools:

| Tool | Example |
|------|---------|
| **Create note** | *Create a note titled 'Project Ideas'* |
| **Read note** | *Read the active note* |
| **Edit note** | *Add a summary to 'Book Review'* |
| **Create folder** | *Create a folder called '2024 Plans'* |
| **List files** | *List all files in 'Research'* |
| **Vault search** | *Find notes about AI agents* |
| **Note filtering** | *Give me yesterday's notes* |
| **Web search** | *What's the weather in Tokyo today?* |

### File Import
Attach images, PDFs, and text files directly to your messages using the attachment button. The agent will read and reason about them alongside your message.

### Token & Model Info
Every response shows the model used, total tokens, and thinking tokens (where applicable) in a subtle footer.

### Review Changes
When the agent edits a note, a diff review modal lets you approve or modify changes before they're saved.

### Keyboard Shortcuts
| Action | Default |
|--------|---------|
| Toggle chat panel | Ctrl+N / Cmd+N |
| Switch model | (unbound — set in Obsidian Settings → Hotkeys) |

> **Note:** Ctrl+N / Cmd+N conflicts with Obsidian's built-in "New note" shortcut. Remap either one in Settings → Hotkeys (search for "agent" or "Nao").

## Chat Management

Chats are stored as Markdown files in a configurable folder. Rename a chat by renaming the file.

> **Caution:** Chat files contain message metadata. Do not edit them manually.

## Privacy

This plugin sends your messages and relevant note content to the AI provider you select (Google, OpenAI, Anthropic, or your local Ollama instance). No data is collected or transmitted by the plugin itself.

You are responsible for obtaining and managing your own API keys.

## License

MIT — see [LICENSE](LICENSE).
