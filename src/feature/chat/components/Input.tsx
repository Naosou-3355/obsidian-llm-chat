import { useState, useEffect, useRef } from "react";
import { AtSign, X, CornerDownLeft, ChevronDown, Image, FileText } from "lucide-react";
import { TFile } from "obsidian";
import { getApp, getPlugin, getSettings } from "src/plugin";
import { handleCall } from "src/feature/chat/handlers/aiHandlers";
import { AddContextModal } from "src/feature/modals/AddContextModal";
import { ChooseModelModal } from "src/feature/modals/ChooseModelModal";
import { allAvailableModels } from "src/settings/models";
import { Attachment, InputProps } from "src/types/chat";
import { Model } from "src/types/ai";
import { AgentSettings } from "src/settings/SettingsTab";

export default function Input({
  initialValue,
  activeChat,
  editingMessageIndex,
  isRegeneration,
  setIsEditing,
  setConversation,
  attachments,
}: InputProps) {
  const settings = getSettings();
  const apiKey = (() => {
    switch (settings.provider) {
      case "openai": return settings.openaiApiKey?.trim();
      case "anthropic": return settings.anthropicApiKey?.trim();
      case "ollama": return "ollama-local"; // Ollama doesn't need a key
      default: return settings.googleApiKey?.trim();
    }
  })();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState<string>(initialValue);
  const canSend = message.trim() && activeChat && apiKey;

  const [selectedModel, setSelectedModel] = useState<string>(getSettings().model);
  const [selectedNotes, setSelectedNotes] = useState<Attachment[]>(attachments);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [canUpload, setCanUpload] = useState<boolean>(false);

  useEffect(() => {
    const plugin = getPlugin();
  
    const handleSettingsUpdate = (newSettings: AgentSettings) => {
      setSelectedModel(newSettings.model);
      setCanUpload(
        allAvailableModels.find(m => m.name === newSettings.model)?.capabilities.includes("vision") ?? false
      );
    };
  
    plugin.settingsEmitter.on("settings-updated", handleSettingsUpdate);
  
    // Cleanup
    return () => {
      plugin.settingsEmitter.off("settings-updated", handleSettingsUpdate);
    };
  }, []);
  
  useEffect(() => {
    const model = allAvailableModels.find(m => m.name === selectedModel);
    setCanUpload(model?.capabilities.includes("vision") ?? false);
  }, [selectedModel])

  // Disable or not the button
  const getButtonTitle = () => {
    if (!apiKey) return `Set an API key for ${settings.provider}`;
    if (!message.trim()) return "Write something";
    return "Send message";
  };

  // Hanlder to send message
  const handleSendWithState = async () => {
    setMessage("");
    
    if (isRegeneration && setIsEditing) {
      setIsEditing(false);
    }

    await handleCall(
      activeChat!,
      editingMessageIndex,
      message,
      selectedNotes,
      selectedFiles,
      setConversation,
      isRegeneration,
    )
  }

  // Open the ModelPickerModal
  const openModelPicker = () => {
    const app = getApp();
    const plugin = getPlugin();
    const settings = getSettings();

    new ChooseModelModal(
      app, 
      (model: Model) => {
        // Change model in the settings and save changes
        settings.provider = model.provider;
        settings.model = model.name; 
        plugin.saveSettings();
        
        // Change the states
        setSelectedModel(model.name); 
        setCanUpload(model.capabilities.includes("vision"));
        // Clean file list if model doesn't support images
        if (!model.capabilities.includes("vision")) setSelectedFiles([]);
        
        return;
      }
    ).open();
  }

  // Open the AddContextModal
  const openNotePicker = () => {
    const app = getApp();
    new AddContextModal(
      app, 
      (note: TFile) => {
        setSelectedNotes((prev) => {
          // If no previous notes, create new array with the note
          if (!prev) return [{path: note.path, basename: note.basename}];
          // Check if note already exists in the list
          const noteExists = prev.some((existingNote) => existingNote.path === note.path);
          if (noteExists) return prev;
          // Add new note to existing array
          return [...prev, {path: note.path, basename: note.basename}];
        });
      }
    ).open();
  }
  // Removes a note from the selected notes
  const removeNote = (toRemove: Attachment) => {
    setSelectedNotes((prev) => {
      if (!prev) return [];
      
      const filteredNotes = prev.filter((note) => note.path !== toRemove.path);
      return filteredNotes;
    });
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newfiles = Array.from(files);
      setSelectedFiles(prev => [...prev, ...newfiles]);
    }
    // Reset the input value so the same image can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  // Remove a image from the selected files
  const removeImage = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="obsidian-agent__input__container">
      {(isRegeneration && setIsEditing) && (
        <button onClick={() => setIsEditing(false)} className="obsidian-agent__button-icon obsidian-agent__button-exit-editing">
          <X size={16}/>
        </button>
      )}

      <div className="obsidian-agent__input__context-container">
        {/* Button to add context */}
        <button 
          title="Add context"
          onClick={openNotePicker} 
          className="obsidian-agent__input__add-context-button"
        >
          <AtSign size={14} />
        </button>
        
        {/* Show selected notes and images */}
        {selectedNotes.map((note) => (
          <div key={note.path} className="obsidian-agent__input__attachment-tag">
            <span className="obsidian-agent__input__attachment-text">{note.basename}</span>
            <button 
              onClick={() => removeNote(note)} 
              className="obsidian-agent__input__remove-attachment-button"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {selectedFiles.map((file, index) => {
          const isImage = file.type.startsWith("image/");
          return (
            <div key={index} className="obsidian-agent__input__attachment-tag">
              {isImage ? (
                <img src={URL.createObjectURL(file)} alt={file.name} className="obsidian-agent__input__attachment-image"/>
              ) : (
                <FileText size={12} />
              )}
              <span className="obsidian-agent__input__attachment-text">{file.name}</span>
              <button
                onClick={() => removeImage(index)}
                className="obsidian-agent__button-icon obsidian-agent__width-auto"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="obsidian-agent__input__textarea-container">
        <textarea
          placeholder="Send a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendWithState();
            }
          }}
          className="obsidian-agent__input__textarea"
        />
      </div>

      <div className="obsidian-agent__input__actions">
        <button 
          onClick={openModelPicker} 
          className="obsidian-agent__input__select-model-button"
        >
          <ChevronDown size={14}/>
          {selectedModel}
        </button>
        
        <div className="obsidian-agent__input__right-actions">
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="obsidian-agent__input__attach-image-button"
              title={canUpload ? "Attach images or documents" : "File upload not supported by current model"}
              disabled={!canUpload}
            >
              <Image size={18} />
            </button>
            <input
              className="obsidian-agent__display-none"
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt"
              multiple
            >
            </input>
          </div>
          <button
            className="obsidian-agent__input__submit_button"
            onClick={handleSendWithState}
            title={getButtonTitle()}
            disabled={!canSend}
          >
            submit
            <CornerDownLeft size={14} />
          </button>
        </div>
      </div>
    </div> 
  );
}