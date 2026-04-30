import { PluginSettingTab, App, Setting, DropdownComponent, TFolder, setIcon, Notice, ButtonComponent } from "obsidian";
import { ObsidianAgentPlugin, getApp, getPlugin } from "src/plugin";
import { ChooseModelModal } from "src/feature/modals/ChooseModelModal";
import { ThinkingLevel } from "@google/genai";
import { allAvailableModels } from "src/settings/models";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Interface for the settings of the plugin
export interface AgentSettings {
  provider: string;
  model: string;
  googleApiKey: string;
  baseUrl: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  ollamaEndpoint: string;
  temperature: string;
  thinkingLevel: string;
  maxOutputTokens: string;
  rules: string;
  chatsFolder: string;
  maxHistoryTurns: number;
  generateChatName: boolean;
  readImages: boolean;
  reviewChanges: boolean;
  debug: boolean;
  sidebarIcon: string;
}

// Default settings for the plugin
export const DEFAULT_SETTINGS: AgentSettings = {
  provider: "google",
  model: "gemini-2.5-flash",
  googleApiKey: "",
  baseUrl: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  ollamaEndpoint: "http://localhost:11434/v1",
  temperature: "Default",
  thinkingLevel: "Default",
  maxOutputTokens: "Default",
  rules: "",
  chatsFolder: "Chats",
  maxHistoryTurns: 2,
  generateChatName: true,
  readImages: true,
  reviewChanges: true,
  debug: false,
  sidebarIcon: "brain-cog",
};

// ─── Ollama model library ────────────────────────────────────────────────────
interface OllamaModelEntry { name: string; label: string; size: string; category: string; }

const OLLAMA_LIBRARY: OllamaModelEntry[] = [
  // Meta
  { name: "llama3.2:1b",         label: "Llama 3.2 · 1B",          size: "~700 MB",  category: "Meta" },
  { name: "llama3.2:3b",         label: "Llama 3.2 · 3B",          size: "~2 GB",    category: "Meta" },
  { name: "llama3.1:8b",         label: "Llama 3.1 · 8B",          size: "~4.7 GB",  category: "Meta" },
  { name: "llama3.1:70b",        label: "Llama 3.1 · 70B",         size: "~40 GB",   category: "Meta" },
  { name: "llama3.1:405b",       label: "Llama 3.1 · 405B",        size: "~231 GB",  category: "Meta" },
  // Google
  { name: "gemma3:1b",           label: "Gemma 3 · 1B",            size: "~0.8 GB",  category: "Google" },
  { name: "gemma3:4b",           label: "Gemma 3 · 4B",            size: "~3 GB",    category: "Google" },
  { name: "gemma3:12b",          label: "Gemma 3 · 12B",           size: "~8 GB",    category: "Google" },
  { name: "gemma3:27b",          label: "Gemma 3 · 27B",           size: "~17 GB",   category: "Google" },
  // Microsoft
  { name: "phi4-mini:3.8b",      label: "Phi-4 Mini · 3.8B",       size: "~2.5 GB",  category: "Microsoft" },
  { name: "phi4:14b",            label: "Phi-4 · 14B",             size: "~9 GB",    category: "Microsoft" },
  // Mistral
  { name: "mistral:7b",          label: "Mistral · 7B",            size: "~4.1 GB",  category: "Mistral" },
  { name: "mistral-nemo:12b",    label: "Mistral Nemo · 12B",      size: "~7.1 GB",  category: "Mistral" },
  { name: "mistral-small:22b",   label: "Mistral Small · 22B",     size: "~13 GB",   category: "Mistral" },
  // Alibaba
  { name: "qwen3:0.6b",          label: "Qwen 3 · 0.6B",           size: "~0.4 GB",  category: "Alibaba" },
  { name: "qwen3:1.7b",          label: "Qwen 3 · 1.7B",           size: "~1 GB",    category: "Alibaba" },
  { name: "qwen3:4b",            label: "Qwen 3 · 4B",             size: "~2.6 GB",  category: "Alibaba" },
  { name: "qwen3:8b",            label: "Qwen 3 · 8B",             size: "~5 GB",    category: "Alibaba" },
  { name: "qwen3:14b",           label: "Qwen 3 · 14B",            size: "~9 GB",    category: "Alibaba" },
  { name: "qwen3:30b",           label: "Qwen 3 · 30B",            size: "~19 GB",   category: "Alibaba" },
  // DeepSeek
  { name: "deepseek-r1:1.5b",    label: "DeepSeek R1 · 1.5B",      size: "~1 GB",    category: "DeepSeek" },
  { name: "deepseek-r1:7b",      label: "DeepSeek R1 · 7B",        size: "~4.7 GB",  category: "DeepSeek" },
  { name: "deepseek-r1:14b",     label: "DeepSeek R1 · 14B",       size: "~9 GB",    category: "DeepSeek" },
  { name: "deepseek-r1:32b",     label: "DeepSeek R1 · 32B",       size: "~20 GB",   category: "DeepSeek" },
  { name: "deepseek-r1:70b",     label: "DeepSeek R1 · 70B",       size: "~43 GB",   category: "DeepSeek" },
  // Code
  { name: "qwen2.5-coder:7b",    label: "Qwen 2.5 Coder · 7B",     size: "~4.7 GB",  category: "Code" },
  { name: "qwen2.5-coder:32b",   label: "Qwen 2.5 Coder · 32B",    size: "~20 GB",   category: "Code" },
  { name: "codellama:7b",        label: "Code Llama · 7B",         size: "~3.8 GB",  category: "Code" },
  // Vision
  { name: "llava:7b",            label: "LLaVA · 7B (vision)",     size: "~4.5 GB",  category: "Vision" },
  { name: "moondream:1.8b",      label: "Moondream · 1.8B (vision)", size: "~1.7 GB", category: "Vision" },
];

// Builds the Ollama dropdown with a static library list grouped by category
function buildOllamaDropdownStatic(selectEl: HTMLSelectElement, currentModel: string): void {
  selectEl.empty();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.text = "Select a model…";
  placeholder.disabled = true;
  selectEl.appendChild(placeholder);

  const categories = [...new Set(OLLAMA_LIBRARY.map(m => m.category))];
  categories.forEach(cat => {
    const group = document.createElement("optgroup");
    group.label = `Available to pull — ${cat}`;
    OLLAMA_LIBRARY.filter(m => m.category === cat).forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.text = `${m.label}  ·  ${m.size}`;
      if (m.name === currentModel) opt.selected = true;
      group.appendChild(opt);
    });
    selectEl.appendChild(group);
  });

  if (currentModel) selectEl.value = currentModel;
}

// Fetches locally installed Ollama models and inserts them at the top of the dropdown
async function fetchAndPrependInstalledModels(
  endpoint: string,
  currentModel: string,
  selectEl: HTMLSelectElement,
): Promise<void> {
  try {
    const base = endpoint.replace(/\/v1\/?$/, "");
    const resp = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return;

    const data = await resp.json() as { models?: { name: string; size: number }[] };
    if (!data.models?.length) return;

    // Remove any previous installed group
    selectEl.querySelector('optgroup[data-installed]')?.remove();

    const group = document.createElement("optgroup");
    group.label = "✓ Installed on this machine";
    group.setAttribute("data-installed", "true");

    data.models.forEach(m => {
      const gb = (m.size / 1e9).toFixed(1);
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.text = `${m.name}  ·  ${gb} GB`;
      if (m.name === currentModel) opt.selected = true;
      group.appendChild(opt);
    });

    // Insert after the placeholder (first child)
    const placeholder = selectEl.firstChild;
    if (placeholder?.nextSibling) {
      selectEl.insertBefore(group, placeholder.nextSibling);
    } else {
      selectEl.appendChild(group);
    }

    if (currentModel) selectEl.value = currentModel;
  } catch {
    // Ollama not running — static list is still shown
  }
}

// ─── API test button helper ──────────────────────────────────────────────────
const ERROR_REFERENCE_TABLE = `
## Common errors reference

| Error | Meaning | Fix |
|-------|---------|-----|
| \`401 authentication_error\` | API key is invalid or missing | Regenerate at your provider's dashboard |
| \`400 credit_balance_insufficient\` | No API credits remaining | Add credits at console.anthropic.com → Billing. **Note: Claude.ai Max/Pro subscription ≠ API credits — they are billed separately.** |
| \`403 permission_error\` | Model not accessible on your plan | Upgrade your API tier or choose a different model |
| \`429 rate_limit_error\` | Too many requests | Wait a moment and retry |
| \`529 overloaded_error\` | Provider servers overloaded | Retry later |
| \`400 invalid_request_error\` | Malformed request or wrong model ID | Check the model name in Settings |
| OpenAI \`401\` | Invalid API key | Regenerate at platform.openai.com → API Keys |
| Google \`400\` | Invalid API key | Regenerate at aistudio.google.com → API Keys |
| Ollama connection refused | Ollama not running | Start Ollama: \`ollama serve\` |

> **Claude.ai subscription vs Anthropic API**: A Claude.ai Max/Pro plan gives you access to claude.ai in the browser only. API usage requires separate credits at console.anthropic.com → Billing.
`;

function extractErrorDetails(e: unknown): Record<string, unknown> {
  if (!(e instanceof Error)) return { raw: String(e) };
  const details: Record<string, unknown> = { name: e.name, message: e.message };
  const a = e as any;
  if (a.status !== undefined)     details.status = a.status;
  if (a.statusCode !== undefined) details.statusCode = a.statusCode;
  if (a.code !== undefined)       details.code = a.code;
  if (a.type !== undefined)       details.type = a.type;
  if (a.error !== undefined)      details.error = a.error;
  if (a.param !== undefined)      details.param = a.param;
  if (a.stack)                    details.stack = a.stack;
  return details;
}

function downloadAsMd(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function addApiKeyTestButton(setting: Setting, providerName: string, testFn: () => Promise<void>): void {
  const statusEl = setting.controlEl.createSpan({ cls: "obsidian-agent__api-test-status" });
  let savedLog = "";

  setting.addButton((btn) => {
    btn.setButtonText("Test").onClick(async () => {
      btn.setButtonText("…").setDisabled(true);
      statusEl.textContent = "";
      statusEl.className = "obsidian-agent__api-test-status";
      savedLog = "";

      const ts = new Date().toISOString();
      const logLines: string[] = [
        `# Nao's LLM — API key test log`,
        ``,
        `- **Provider**: ${providerName}`,
        `- **Timestamp**: ${ts}`,
        ``,
        ERROR_REFERENCE_TABLE,
        `---`,
        `## Test result`,
        ``,
      ];

      try {
        await testFn();
        statusEl.textContent = "✓ Connected";
        statusEl.classList.add("obsidian-agent__api-test-status--ok");
        logLines.push("**Result**: SUCCESS ✓");
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const details = extractErrorDetails(e);
        logLines.push("**Result**: FAILED ✗");
        logLines.push(`\n**Full error object**:\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``);

        if (/credit\s+balance|credit_balance_insufficient/i.test(raw)) {
          statusEl.textContent = "⚠ Key valid — no API credits (Claude.ai plan ≠ API credits)";
          statusEl.classList.add("obsidian-agent__api-test-status--ok");
        } else {
          statusEl.textContent = "✗ " + raw;
          statusEl.classList.add("obsidian-agent__api-test-status--error");
        }
      } finally {
        btn.setButtonText("Test").setDisabled(false);
        savedLog = logLines.join("\n");
      }
    });
  });

  setting.addExtraButton((saveBtn) => {
    saveBtn.setIcon("download").setTooltip("Download full test log as .md").onClick(() => {
      if (!savedLog) { new Notice("Run the test first to generate a log."); return; }
      downloadAsMd(`api-test-${providerName}-${Date.now()}.md`, savedLog);
    });
  });
}

// ─── Settings tab ────────────────────────────────────────────────────────────
export class AgentSettingsTab extends PluginSettingTab {
  plugin: ObsidianAgentPlugin;

  constructor(app: App, plugin: ObsidianAgentPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Keep a reference to the model button so the Ollama picker can update it
    let modelButton: ButtonComponent | null = null;

    // ── Model selection ───────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Model")
      .setDesc("The AI model currently in use. Click to open the model picker and switch between Gemini, OpenAI, Claude, and Ollama models.")
      .addButton((button) => {
        modelButton = button;
        button.setButtonText(this.plugin.settings.model || "Choose model");
        button.onClick(() => {
          new ChooseModelModal(getApp(), (model) => {
            this.plugin.settings.model = model.name;
            this.plugin.settings.provider = model.provider;
            getPlugin().saveSettings();
            button.setButtonText(model.name);
            this.display();
          }).open();
        });
        return button;
      });

    // ── API keys ──────────────────────────────────────────────────────────────
    new Setting(containerEl).setName("API keys").setHeading();

    // Google
    const googleSetting = new Setting(containerEl)
      .setName("Google API key")
      .setDesc("Required to use Gemini models. Get a free key at aistudio.google.com → Get API key. No credit card needed for the free tier.");
    if (this.plugin.settings.provider === "google")
      googleSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    let googleRevealed = false;
    googleSetting.addText((text) => {
      text.setPlaceholder("Enter your Google API key.")
        .setValue(this.plugin.settings.googleApiKey)
        .onChange(async (value) => { this.plugin.settings.googleApiKey = value; await this.plugin.saveSettings(); });
      text.inputEl.type = "password";
    });
    googleSetting.addExtraButton((btn) => {
      btn.setIcon("eye").setTooltip("Show/hide").onClick(() => {
        googleRevealed = !googleRevealed;
        const input = googleSetting.controlEl.querySelector("input");
        if (input) input.type = googleRevealed ? "text" : "password";
        btn.setIcon(googleRevealed ? "eye-off" : "eye");
      });
    });
    addApiKeyTestButton(googleSetting, "google", async () => {
      const ai = new GoogleGenAI({ apiKey: this.plugin.settings.googleApiKey });
      await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: "Hi" }] }],
        config: { maxOutputTokens: 1 },
      });
    });

    // Google base URL
    const googleBaseUrlSetting = new Setting(containerEl)
      .setName("Google base URL")
      .setDesc("Advanced — only fill this if you are using a proxy or self-hosted Gemini endpoint. Leave blank to use Google's default servers.")
      .addText((text) => {
        text.setPlaceholder("https://generativelanguage.googleapis.com")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => { this.plugin.settings.baseUrl = value; await this.plugin.saveSettings(); });
      });
    if (this.plugin.settings.provider === "google")
      googleBaseUrlSetting.settingEl.addClass("obsidian-agent__settings-active-provider");

    // OpenAI
    const openaiSetting = new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Required to use GPT-4o and o3-mini models. Get a key at platform.openai.com → API keys. Usage is billed per token.");
    if (this.plugin.settings.provider === "openai")
      openaiSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    let openaiRevealed = false;
    openaiSetting.addText((text) => {
      text.setPlaceholder("sk-...")
        .setValue(this.plugin.settings.openaiApiKey)
        .onChange(async (value) => { this.plugin.settings.openaiApiKey = value; await this.plugin.saveSettings(); });
      text.inputEl.type = "password";
    });
    openaiSetting.addExtraButton((btn) => {
      btn.setIcon("eye").setTooltip("Show/hide").onClick(() => {
        openaiRevealed = !openaiRevealed;
        const input = openaiSetting.controlEl.querySelector("input");
        if (input) input.type = openaiRevealed ? "text" : "password";
        btn.setIcon(openaiRevealed ? "eye-off" : "eye");
      });
    });
    addApiKeyTestButton(openaiSetting, "openai", async () => {
      const client = new OpenAI({ apiKey: this.plugin.settings.openaiApiKey, dangerouslyAllowBrowser: true });
      await client.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: "Hi" }], max_tokens: 1 });
    });

    // Anthropic
    const anthropicSetting = new Setting(containerEl)
      .setName("Anthropic API key")
      .setDesc("Required to use Claude models. Get a key at console.anthropic.com → API keys. Important: a Claude.ai Max/Pro subscription is separate — API usage requires its own credits at console.anthropic.com → Billing.");
    if (this.plugin.settings.provider === "anthropic")
      anthropicSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    let anthropicRevealed = false;
    anthropicSetting.addText((text) => {
      text.setPlaceholder("sk-ant-...")
        .setValue(this.plugin.settings.anthropicApiKey)
        .onChange(async (value) => { this.plugin.settings.anthropicApiKey = value; await this.plugin.saveSettings(); });
      text.inputEl.type = "password";
    });
    anthropicSetting.addExtraButton((btn) => {
      btn.setIcon("eye").setTooltip("Show/hide").onClick(() => {
        anthropicRevealed = !anthropicRevealed;
        const input = anthropicSetting.controlEl.querySelector("input");
        if (input) input.type = anthropicRevealed ? "text" : "password";
        btn.setIcon(anthropicRevealed ? "eye-off" : "eye");
      });
    });
    addApiKeyTestButton(anthropicSetting, "anthropic", async () => {
      const client = new Anthropic({ apiKey: this.plugin.settings.anthropicApiKey, dangerouslyAllowBrowser: true });
      await client.messages.create({ model: "claude-3-5-haiku-20241022", max_tokens: 1, messages: [{ role: "user", content: "Hi" }] });
    });

    // Ollama endpoint
    const ollamaSetting = new Setting(containerEl)
      .setName("Ollama endpoint")
      .setDesc("The address of your local Ollama server. Ollama runs AI models on your own computer — no API key or internet needed. Default: http://localhost:11434/v1. Make sure Ollama is running first (run `ollama serve` in a terminal).");
    if (this.plugin.settings.provider === "ollama")
      ollamaSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    ollamaSetting.addText((text) => {
      text.setPlaceholder("http://localhost:11434/v1")
        .setValue(this.plugin.settings.ollamaEndpoint)
        .onChange(async (value) => { this.plugin.settings.ollamaEndpoint = value; await this.plugin.saveSettings(); });
    });
    addApiKeyTestButton(ollamaSetting, "ollama", async () => {
      const base = this.plugin.settings.ollamaEndpoint.replace(/\/v1\/?$/, "");
      const resp = await fetch(`${base}/api/version`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    });

    // Ollama model picker
    let ollamaSelectEl: HTMLSelectElement | null = null;

    const ollamaModelSetting = new Setting(containerEl)
      .setName("Ollama model")
      .setDesc(
        "Choose which Ollama model to use. Models already installed on your machine appear first (✓ Installed). " +
        "The rest are popular models you can download by running `ollama pull <model-name>` in a terminal. " +
        "Selecting a model here automatically sets it as the active model and switches the provider to Ollama."
      );
    if (this.plugin.settings.provider === "ollama")
      ollamaModelSetting.settingEl.addClass("obsidian-agent__settings-active-provider");

    ollamaModelSetting.addDropdown((dropdown) => {
      ollamaSelectEl = dropdown.selectEl;
      buildOllamaDropdownStatic(dropdown.selectEl, this.plugin.settings.model);
      fetchAndPrependInstalledModels(
        this.plugin.settings.ollamaEndpoint,
        this.plugin.settings.model,
        dropdown.selectEl,
      );

      dropdown.onChange(async (value) => {
        if (!value) return;
        this.plugin.settings.model = value;
        this.plugin.settings.provider = "ollama";
        await this.plugin.saveSettings();
        if (modelButton) modelButton.setButtonText(value);
      });
      return dropdown;
    });

    ollamaModelSetting.addExtraButton((btn) => {
      btn.setIcon("refresh-cw").setTooltip("Refresh installed models").onClick(() => {
        if (!ollamaSelectEl) return;
        buildOllamaDropdownStatic(ollamaSelectEl, this.plugin.settings.model);
        fetchAndPrependInstalledModels(
          this.plugin.settings.ollamaEndpoint,
          this.plugin.settings.model,
          ollamaSelectEl,
        );
      });
    });

    // ── LLM parameters ────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Temperature")
      .setDesc("Controls how creative or predictable the AI's responses are. 0 = very focused and repetitive. 2 = very creative but may go off-topic. Leave at 'Default' if you're unsure — it works well for most tasks. Range: 0–2.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.temperature))
          .onChange(async (value) => {
            const num = Number(value);
            this.plugin.settings.temperature = (Number.isNaN(num) || num > 2 || num < 0) ? DEFAULT_SETTINGS.temperature : value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max output tokens")
      .setDesc("The maximum length of the AI's response. Higher values allow longer answers but are slower and cost more. Leave at 'Default' for most use cases. 1 token ≈ 0.75 words.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxOutputTokens))
          .onChange(async (value) => {
            const num = Number(value);
            this.plugin.settings.maxOutputTokens = (Number.isNaN(num) || num < 0) ? DEFAULT_SETTINGS.maxOutputTokens : value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Thinking level")
      .setDesc("Only applies to supported Gemini models. Controls how much the model 'thinks through' a problem before answering. Higher = slower but better reasoning. Leave at 'Default' if unsure.")
      .addDropdown((dropdown: DropdownComponent) => {
        dropdown.addOption("Low", "Low");
        dropdown.addOption("High", "High");
        dropdown.addOption("Default", "Default");
        dropdown.setValue(this.plugin.settings.thinkingLevel)
          .onChange(async (value) => { this.plugin.settings.thinkingLevel = value as ThinkingLevel; await this.plugin.saveSettings(); });
      });

    // ── Agent rules ───────────────────────────────────────────────────────────
    const rulesSetting = new Setting(containerEl)
      .setName("Agent rules")
      .setDesc("Custom instructions added to every conversation. Use this to change how the AI behaves — e.g. 'Always reply in French', 'Keep answers under 3 paragraphs', or 'You are a Zettelkasten assistant'.");

    rulesSetting.settingEl.classList.add("obsidian-agent__settings-rules-container");
    rulesSetting.controlEl.classList.add("obsidian-agent__settings-rules-control");

    rulesSetting.addTextArea((text) => {
      text.setValue(this.plugin.settings.rules)
        .onChange(async (value) => { this.plugin.settings.rules = value; await this.plugin.saveSettings(); });
      text.inputEl.placeholder = "E.g. Always answer in Spanish.";
      text.inputEl.rows = 4;
      text.inputEl.classList.add("obsidian-agent__settings-rules-textarea");
    });

    // ── History settings ──────────────────────────────────────────────────────
    new Setting(containerEl).setName("History settings").setHeading();

    new Setting(containerEl)
      .setName("Chat history folder")
      .setDesc("The vault folder where your conversations are saved as Markdown files. Each chat is stored as one file so you can search, link, or archive them like any note.")
      .addDropdown((dropdown: DropdownComponent) => {
        const folders = this.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder && !f.isRoot());
        folders.forEach(f => dropdown.addOption(f.path, f.name));
        dropdown.setValue(this.plugin.settings.chatsFolder)
          .onChange(async (value) => { this.plugin.settings.chatsFolder = value; await this.plugin.saveSettings(); });
      });

    new Setting(containerEl)
      .setName("Max history messages")
      .setDesc("How many past messages the AI can 'remember' when composing a reply. More = better context awareness, but slower and costlier. 2–6 is a good range for most use cases. Minimum: 1.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxHistoryTurns))
          .onChange(async (value) => {
            const n = Number(value);
            this.plugin.settings.maxHistoryTurns = (Number.isNaN(n) || n <= 0) ? DEFAULT_SETTINGS.maxHistoryTurns : n;
            await this.plugin.saveSettings();
          })
      );

    // ── Agent skills ──────────────────────────────────────────────────────────
    new Setting(containerEl).setName("Agent skills").setHeading();

    new Setting(containerEl)
      .setName("Generate chat name")
      .setDesc("Automatically creates a short title for each new chat based on your first message. Makes it easier to find past conversations. Uses a small AI call — disable to save tokens.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.generateChatName)
          .onChange(async (value) => { this.plugin.settings.generateChatName = value; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Read images")
      .setDesc("When the AI reads one of your notes, it will also describe any embedded images it finds, so it can reason about them. Disable to speed things up if your notes don't contain images.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.readImages)
          .onChange(async (value) => { this.plugin.settings.readImages = value; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Review changes")
      .setDesc("Before the AI edits any note, shows you a side-by-side diff so you can approve or reject the changes. Recommended to keep this on to avoid unexpected modifications to your notes.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.reviewChanges)
          .onChange(async (value) => { this.plugin.settings.reviewChanges = value; await this.plugin.saveSettings(); })
      );

    // ── Appearance ────────────────────────────────────────────────────────────
    new Setting(containerEl).setName("Appearance").setHeading();

    const iconSetting = new Setting(containerEl)
      .setName("Sidebar icon")
      .setDesc("The icon shown on the left sidebar button. Type any icon name from lucide.dev/icons. The preview updates as you type. Default: brain-cog.");

    const previewEl = iconSetting.controlEl.createDiv({ cls: "obsidian-agent__icon-preview" });
    setIcon(previewEl, (this.plugin.settings.sidebarIcon || "brain-cog") as any);

    iconSetting.addText((text) => {
      text.setPlaceholder("brain-cog")
        .setValue(this.plugin.settings.sidebarIcon)
        .onChange(async (value) => {
          const iconName = value.trim() || "brain-cog";
          this.plugin.settings.sidebarIcon = iconName;
          previewEl.empty();
          setIcon(previewEl, iconName as any);
          await this.plugin.saveSettings();
        });
    });

    // ── Developer settings ────────────────────────────────────────────────────
    new Setting(containerEl).setName("Developer settings").setHeading();

    new Setting(containerEl)
      .setName("Debug mode")
      .setDesc("Prints detailed technical logs to the browser developer console (F12 → Console). Only useful when troubleshooting a problem — leave off otherwise.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debug)
          .onChange(async (value) => { this.plugin.settings.debug = value; await this.plugin.saveSettings(); })
      );

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    new Setting(containerEl).setName("Keyboard shortcuts").setHeading();

    new Setting(containerEl)
      .setName("Toggle chat panel")
      .setDesc("Default: Ctrl+N on all platforms (including Mac). May conflict with Obsidian's built-in 'New note' shortcut — remap either one in Obsidian Settings → Hotkeys (search for 'agent').");

    new Setting(containerEl)
      .setName("Switch model")
      .setDesc("No default binding. Add a shortcut in Obsidian Settings → Hotkeys, then search for 'Switch model'.");

    // ── Reset ─────────────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Reset settings")
      .setDesc("Restores all settings to their original default values. Reopen the Settings tab after clicking to see the changes applied.")
      .addButton((button) => {
        button.setButtonText("Reset");
        button.onClick(async () => {
          Object.assign(this.plugin.settings, DEFAULT_SETTINGS);
          await this.plugin.saveSettings();
        });
        return button;
      });
  }
}
