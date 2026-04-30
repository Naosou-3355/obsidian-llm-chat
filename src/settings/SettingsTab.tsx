import { PluginSettingTab, App, Setting, DropdownComponent, TFolder, setIcon } from "obsidian";
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

// Helper: adds a Test button to a setting with inline status feedback
function addApiKeyTestButton(setting: Setting, testFn: () => Promise<void>): void {
  const statusEl = setting.controlEl.createSpan({ cls: "obsidian-agent__api-test-status" });
  setting.addButton((btn) => {
    btn.setButtonText("Test").onClick(async () => {
      btn.setButtonText("…").setDisabled(true);
      statusEl.textContent = "";
      statusEl.className = "obsidian-agent__api-test-status";
      try {
        await testFn();
        statusEl.textContent = "✓ Connected";
        statusEl.classList.add("obsidian-agent__api-test-status--ok");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        statusEl.textContent = "✗ " + msg.slice(0, 80);
        statusEl.classList.add("obsidian-agent__api-test-status--error");
      } finally {
        btn.setButtonText("Test").setDisabled(false);
      }
    });
  });
}

// Settings tab class
export class AgentSettingsTab extends PluginSettingTab {
  plugin: ObsidianAgentPlugin;

  constructor(app: App, plugin: ObsidianAgentPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Method that displays the settings tab
  display(): void {
    let { containerEl } = this;
    containerEl.empty();

    // Language model settings
    new Setting(containerEl)
      .setName("Model")
      .setDesc("Select the AI model to use. Supports Gemini, OpenAI, Claude, and Ollama.")
      .addButton((button) => {
        button.setButtonText(this.plugin.settings.model || "Choose model");
        button.onClick(() => {
          const app = getApp();
          const plugin = getPlugin();
          new ChooseModelModal(app, (model) => {
            this.plugin.settings.model = model.name;
            this.plugin.settings.provider = model.provider;
            plugin.saveSettings();
            button.setButtonText(model.name);
            // Refresh the settings tab to show the right API key field
            this.display();
          }).open();
        });
        return button;
      });

    // API keys
    new Setting(containerEl).setName("API keys").setHeading();

    // Google
    const googleSetting = new Setting(containerEl)
      .setName("Google API key")
      .setDesc("Required for Gemini models.");
    if (this.plugin.settings.provider === "google") {
      googleSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    }
    let googleRevealed = false;
    googleSetting.addText((text) => {
      text
        .setPlaceholder("Enter your Google API key.")
        .setValue(this.plugin.settings.googleApiKey)
        .onChange(async (value) => {
          this.plugin.settings.googleApiKey = value;
          await this.plugin.saveSettings();
        });
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
    addApiKeyTestButton(googleSetting, async () => {
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
      .setDesc("Leave blank to use the default Gemini API endpoint.")
      .addText((text) => {
        text
          .setPlaceholder("https://generativelanguage.googleapis.com")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value;
            await this.plugin.saveSettings();
          });
      });
    if (this.plugin.settings.provider === "google") {
      googleBaseUrlSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    }

    // OpenAI
    const openaiSetting = new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Required for GPT and o-series models.");
    if (this.plugin.settings.provider === "openai") {
      openaiSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    }
    let openaiRevealed = false;
    openaiSetting.addText((text) => {
      text
        .setPlaceholder("sk-...")
        .setValue(this.plugin.settings.openaiApiKey)
        .onChange(async (value) => {
          this.plugin.settings.openaiApiKey = value;
          await this.plugin.saveSettings();
        });
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
    addApiKeyTestButton(openaiSetting, async () => {
      const client = new OpenAI({ apiKey: this.plugin.settings.openaiApiKey, dangerouslyAllowBrowser: true });
      await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
    });

    // Anthropic
    const anthropicSetting = new Setting(containerEl)
      .setName("Anthropic API key")
      .setDesc("Required for Claude models.");
    if (this.plugin.settings.provider === "anthropic") {
      anthropicSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    }
    let anthropicRevealed = false;
    anthropicSetting.addText((text) => {
      text
        .setPlaceholder("sk-ant-...")
        .setValue(this.plugin.settings.anthropicApiKey)
        .onChange(async (value) => {
          this.plugin.settings.anthropicApiKey = value;
          await this.plugin.saveSettings();
        });
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
    addApiKeyTestButton(anthropicSetting, async () => {
      const client = new Anthropic({ apiKey: this.plugin.settings.anthropicApiKey, dangerouslyAllowBrowser: true });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      });
    });

    // Ollama endpoint
    const ollamaSetting = new Setting(containerEl)
      .setName("Ollama endpoint")
      .setDesc("Base URL for your local Ollama server.")
      .addText((text) => {
        text
          .setPlaceholder("http://localhost:11434/v1")
          .setValue(this.plugin.settings.ollamaEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.ollamaEndpoint = value;
            await this.plugin.saveSettings();
          });
      });
    if (this.plugin.settings.provider === "ollama") {
      ollamaSetting.settingEl.addClass("obsidian-agent__settings-active-provider");
    }
    addApiKeyTestButton(ollamaSetting, async () => {
      const base = this.plugin.settings.ollamaEndpoint.replace(/\/v1\/?$/, "");
      const resp = await fetch(`${base}/api/version`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    });

    // LLM settings
    new Setting(containerEl)
    .setName("Temperature")
    .setDesc("Higher values make output more random, while lower values make it more focused and deterministic. Min: 0, Max: 2.")
    .addText((text) =>
      text
        .setValue(String(this.plugin.settings.temperature))
        .onChange(async (value) => {
          const num = Number(value);
          if (Number.isNaN(num) || num > 2 || num < 0) {
            this.plugin.settings.temperature = DEFAULT_SETTINGS.temperature;
            await this.plugin.saveSettings();
          } else {
            this.plugin.settings.temperature = value;
            await this.plugin.saveSettings();
          }
        })
    );

    new Setting(containerEl)
    .setName("Max output tokens")
    .setDesc("Set the maximum number of tokens the model can generate in its response.")
    .addText((text) =>
      text
        .setValue(String(this.plugin.settings.maxOutputTokens))
        .onChange(async (value) => {
          const num = Number(value);
          if (Number.isNaN(num) || num < 0) {
            this.plugin.settings.maxOutputTokens = DEFAULT_SETTINGS.maxOutputTokens;
            await this.plugin.saveSettings();
          } else {
            this.plugin.settings.maxOutputTokens = value;
            await this.plugin.saveSettings();
          }
        })
    );

    new Setting(containerEl)
    .setName("Thinking level")
    .setDesc("Set the level of reasoning the model should use. This setting only applies to Gemini 3 models, others use default reasoning level.")
      .addDropdown((dropdown: DropdownComponent) => {
        dropdown.addOption("Low", "Low");
        dropdown.addOption("High", "High");
        dropdown.addOption("Default", "Default");

        dropdown
        .setValue(this.plugin.settings.thinkingLevel)
        .onChange(async (value) => {
          this.plugin.settings.thinkingLevel = value as ThinkingLevel;
          await this.plugin.saveSettings();
        });
      }
    );

    // Agent rules
    const rulesSetting = new Setting(containerEl)
      .setName("Agent rules")
      .setDesc("Add an aditional set of rules to change the agent behaviour.");

    rulesSetting.settingEl.classList.add("obsidian-agent__settings-rules-container");
    rulesSetting.controlEl.classList.add("obsidian-agent__settings-rules-control");

    rulesSetting.addTextArea((text) => {
      text
        .setValue(this.plugin.settings.rules)
        .onChange(async (value) => {
          this.plugin.settings.rules = value;
          await this.plugin.saveSettings();
        });
      text.inputEl.placeholder = "E.g. Always answer in Spanish.";
      text.inputEl.rows = 4;
      text.inputEl.classList.add("obsidian-agent__settings-rules-textarea");
    });

    // History settings
    new Setting(containerEl).setName('History settings').setHeading();

    // Chat history folder
    new Setting(containerEl)
    .setName("Chat history folder")
    .setDesc("Select the folder where your chat histories will be saved.")
    .addDropdown((dropdown: DropdownComponent) => {
      const folders = this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFolder && !file.isRoot());
      folders.forEach(folder => {
        dropdown.addOption(folder.path, folder.name);
      });

      dropdown
        .setValue(this.plugin.settings.chatsFolder)
        .onChange(async (value) => {
          this.plugin.settings.chatsFolder = value;
          await this.plugin.saveSettings();
        });
    });

    // Max turns settings
    new Setting(containerEl)
      .setName("Max history messages")
      .setDesc("Set the maximum number of previous turns (user & bot messages) to include in the memory history. Min value of 1.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maxHistoryTurns))
          .onChange(async (value) => {
            const n = Number(value);
            if (Number.isNaN(n) || n <= 0) {
              this.plugin.settings.maxHistoryTurns = DEFAULT_SETTINGS.maxHistoryTurns;
              await this.plugin.saveSettings();
            } else {
              this.plugin.settings.maxHistoryTurns = n;
              await this.plugin.saveSettings();
            }
          })
      );

    // Agent skills
    new Setting(containerEl).setName('Agent skills').setHeading();

    new Setting(containerEl)
      .setName("Generate chat name")
      .setDesc("The model will automatically generate a name for the chat based on your first message.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.generateChatName)
          .onChange(async (value) => {
            this.plugin.settings.generateChatName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Read images")
      .setDesc("The model will generate captions of the images to understand them, only when reading a note. Otherwise, images will be removed and only text content will be readed.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.readImages)
          .onChange(async (value) => {
            this.plugin.settings.readImages = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Review changes")
      .setDesc("Open a modal every time you execute the edit note tool to review the changes made by the agent.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.reviewChanges)
          .onChange(async (value) => {
            this.plugin.settings.reviewChanges = value;
            await this.plugin.saveSettings();
          })
      );

    // Appearance
    new Setting(containerEl).setName("Appearance").setHeading();

    const iconSetting = new Setting(containerEl)
      .setName("Sidebar icon")
      .setDesc("Lucide icon name for the sidebar button. Examples: bot, brain, sparkles, message-circle. Browse all at lucide.dev/icons.");

    const previewEl = iconSetting.controlEl.createDiv({ cls: "obsidian-agent__icon-preview" });
    setIcon(previewEl, (this.plugin.settings.sidebarIcon || "brain-cog") as any);

    iconSetting.addText((text) => {
      text
        .setPlaceholder("brain-cog")
        .setValue(this.plugin.settings.sidebarIcon)
        .onChange(async (value) => {
          const iconName = value.trim() || "brain-cog";
          this.plugin.settings.sidebarIcon = iconName;
          previewEl.empty();
          setIcon(previewEl, iconName as any);
          await this.plugin.saveSettings();
        });
    });

    // Developer settings
    new Setting(containerEl).setName("Developer settings").setHeading();

    new Setting(containerEl)
      .setName("Debug mode")
      .setDesc("Enable debug mode to see detailed logs and information about the plugin's operation.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.debug)
          .onChange(async (value) => {
            this.plugin.settings.debug = value;
            await this.plugin.saveSettings();
          })
      );

    // Keyboard shortcuts info
    new Setting(containerEl).setName("Keyboard shortcuts").setHeading();

    new Setting(containerEl)
      .setName("Toggle chat panel")
      .setDesc("Default: Ctrl+N (all platforms). May conflict with 'New note' — remap either one in Obsidian Settings → Hotkeys (search for 'agent').");

    new Setting(containerEl)
      .setName("Switch model")
      .setDesc("No default binding. Add one via Obsidian Settings → Hotkeys (search for 'Switch model').");

    new Setting(containerEl)
    .setName("Reset settings")
    .setDesc("Reset settings to default values. Push the button reopen the Settings tab see the applied changes.")
    .addButton((button) => {
      button.setButtonText("Reset");
      button.onClick(async () => {
        this.plugin.settings.provider = DEFAULT_SETTINGS.provider;
        this.plugin.settings.model = DEFAULT_SETTINGS.model;
        this.plugin.settings.baseUrl = DEFAULT_SETTINGS.baseUrl;
        this.plugin.settings.ollamaEndpoint = DEFAULT_SETTINGS.ollamaEndpoint;
        this.plugin.settings.temperature = DEFAULT_SETTINGS.temperature;
        this.plugin.settings.thinkingLevel = DEFAULT_SETTINGS.thinkingLevel;
        this.plugin.settings.maxOutputTokens = DEFAULT_SETTINGS.maxOutputTokens;
        this.plugin.settings.rules = DEFAULT_SETTINGS.rules;
        this.plugin.settings.chatsFolder = DEFAULT_SETTINGS.chatsFolder;
        this.plugin.settings.maxHistoryTurns = DEFAULT_SETTINGS.maxHistoryTurns;
        this.plugin.settings.generateChatName = DEFAULT_SETTINGS.generateChatName;
        this.plugin.settings.readImages = DEFAULT_SETTINGS.readImages;
        this.plugin.settings.reviewChanges = DEFAULT_SETTINGS.reviewChanges;
        this.plugin.settings.debug = DEFAULT_SETTINGS.debug;
        this.plugin.settings.sidebarIcon = DEFAULT_SETTINGS.sidebarIcon;
        await this.plugin.saveSettings();
      });
      return button;
    });
  }
}
