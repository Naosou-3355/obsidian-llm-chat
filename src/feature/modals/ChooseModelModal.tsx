import { SuggestModal, App } from 'obsidian';
import { getSettings } from 'src/plugin';
import { allAvailableModels } from 'src/settings/models';
import { Model } from 'src/types/ai';

interface ModelSeparator {
  isSeparator: true;
  label: string;
}

type ModalItem = Model | ModelSeparator;

const PROVIDER_LABELS: Record<string, string> = {
  google:    "Google",
  openai:    "OpenAI",
  anthropic: "Anthropic",
  ollama:    "Ollama — Local",
};

const PROVIDER_ORDER = ["google", "openai", "anthropic", "ollama"];

export class ChooseModelModal extends SuggestModal<ModalItem> {
  private onChoose: (model: Model) => void;
  protected activeModel: string;

  constructor(app: App, onChoose: (model: Model) => void) {
    super(app);
    const settings = getSettings();
    this.onChoose = onChoose;
    this.activeModel = settings.model;
    this.setPlaceholder("Search models or scroll to browse by provider…");
  }

  // No query → grouped view with provider headings (separators injected)
  // With query → flat filtered list, no headings
  getSuggestions(query: string): ModalItem[] {
    const settings = getSettings();

    const models: Model[] = allAvailableModels.map(m => {
      if (m.provider === "ollama") {
        return {
          ...m,
          name: settings.provider === "ollama" ? settings.model : m.name,
          description: "Running locally on your machine via Ollama. Select or download models in Settings → Ollama model.",
        };
      }
      return m;
    });

    if (!query.trim()) {
      const result: ModalItem[] = [];
      for (const provider of PROVIDER_ORDER) {
        const group = models.filter(m => m.provider === provider);
        if (!group.length) continue;
        result.push({ isSeparator: true, label: PROVIDER_LABELS[provider] ?? provider });
        group.forEach(model => result.push(model));
      }
      return result;
    }

    // Flat search across all models
    const q = query.toLowerCase();
    return models.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q)
    );
  }

  onChooseSuggestion(item: ModalItem, _evt: MouseEvent | KeyboardEvent): void {
    if ('isSeparator' in item) return;
    this.onChoose(item);
  }

  renderSuggestion(item: ModalItem, el: HTMLElement): void {
    el.empty();

    if ('isSeparator' in item) {
      el.addClass("obsidian-agent__model-modal__separator");
      el.setText(item.label);
      return;
    }

    const model = item;
    const providerColorMap: Record<string, string> = {
      google:    "#7895F9",
      openai:    "#74AA9C",
      anthropic: "#CC785C",
      ollama:    "#888888",
    };
    const color = providerColorMap[model.provider.toLowerCase()] ?? "#CCCCCC";

    const wrapper = el.createDiv({ cls: "obsidian-agent__model-modal__suggestion-wrapper" });
    wrapper.createDiv({
      cls: "obsidian-agent__model-modal__color-circle",
      attr: { style: `background: ${color}` },
    });

    const textContainer = wrapper.createDiv({ cls: "obsidian-agent__model-modal__text-container" });

    const nameEl = textContainer.createDiv({ cls: "obsidian-agent__model-modal__name" });
    nameEl.setText(model.name + (model.name === this.activeModel ? " (current)" : ""));

    const caps = model.capabilities.length
      ? "text, " + model.capabilities.join(", ")
      : "text-only";
    textContainer.createDiv({ cls: "obsidian-agent__model-modal__info-bold" }).setText(`Capabilities: ${caps}`);
    textContainer.createDiv({ cls: "obsidian-agent__model-modal__info" }).setText(model.description);
  }
}
