import React, { useState } from 'react';
import { X } from 'lucide-react';

export type Theme = 'gemini' | 'chatgpt' | 'shadcn' | 'dark' | 'light';
export type AgentPolicy = 'ask' | 'safe' | 'yolo';

export type Settings = {
  agentPolicy: AgentPolicy;
  chat: {
    autoScroll: boolean;
    renderMermaid: boolean;
    showLogs: boolean;
    autoTitle: boolean;
  };
  appearance: {
    theme: Theme;
  };
};

export const defaultSettings: Settings = {
  agentPolicy: 'ask',
  chat: {
    autoScroll: true,
    renderMermaid: true,
    showLogs: false,
    autoTitle: true,
  },
  appearance: {
    theme: 'gemini',
  }
};

interface SettingsModalProps {
  settings: Settings;
  setSettings: (s: Settings) => void;
  onClose: () => void;
  onClearChats: () => void;
}

export default function SettingsModal({ settings, setSettings, onClose, onClearChats }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  const updateSettings = (partial: Partial<Settings>) => {
    setLocalSettings({ ...localSettings, ...partial });
  };

  const handleSave = () => {
    setSettings(localSettings);
    onClose();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setLocalSettings(defaultSettings);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] text-gray-100">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          {/* Agent Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-gray-700 pb-2">Agent</h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Command execution policy:</label>
              <div className="space-y-2 pl-2">
                {(['ask', 'safe', 'yolo'] as const).map(policy => (
                  <label key={policy} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="agentPolicy"
                      value={policy}
                      checked={localSettings.agentPolicy === policy}
                      onChange={(e) => updateSettings({ agentPolicy: e.target.value as AgentPolicy })}
                      className="text-blue-500 bg-gray-900 border-gray-700 focus:ring-blue-500"
                    />
                    <span className="text-sm capitalize text-gray-300">
                      {policy === 'ask' ? 'Ask every time' : policy === 'safe' ? 'Auto approve safe commands' : 'Auto approve all (YOLO)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Chat Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-gray-700 pb-2">Chat</h3>
            <div className="space-y-3">
              {[
                { key: 'autoScroll', label: 'Auto scroll to latest message' },
                { key: 'renderMermaid', label: 'Render mermaid diagrams' },
                { key: 'showLogs', label: 'Show raw CLI logs' },
                { key: 'autoTitle', label: 'Auto generate chat titles' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.chat[key as keyof Settings['chat']]}
                    onChange={(e) => updateSettings({ chat: { ...localSettings.chat, [key]: e.target.checked } })}
                    className="rounded bg-gray-900 border-gray-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Appearance Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-gray-700 pb-2">Appearance</h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Theme:</label>
              <select
                value={localSettings.appearance.theme}
                onChange={(e) => updateSettings({ appearance: { theme: e.target.value as Theme } })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="gemini">Gemini</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="shadcn">Shadcn assistant</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </section>

          {/* Reset Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-red-400 border-b border-gray-700 pb-2">Danger Zone</h3>
            <div className="flex gap-4">
              <button
                onClick={onClearChats}
                className="px-4 py-2 bg-red-900/50 text-red-200 hover:bg-red-800/80 rounded-lg text-sm transition-colors border border-red-800"
              >
                Clear all chats
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-700 text-gray-200 hover:bg-gray-600 rounded-lg text-sm transition-colors border border-gray-600"
              >
                Reset all settings
              </button>
            </div>
          </section>
        </div>

        <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
