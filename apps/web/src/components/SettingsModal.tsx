import { useState } from 'react';
import { X } from 'lucide-react';
import { UIMode, AgentPolicy, Settings, defaultSettings, Theme } from '../types/settings';

export type { UIMode, AgentPolicy, Settings, Theme };
export { defaultSettings };

interface SettingsModalProps {
  projects: string[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  onClose: () => void;
  onClearChats: () => void;
}

export default function SettingsModal({ projects, settings, setSettings, onClose, onClearChats }: SettingsModalProps) {
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

  const updateProjectPolicy = (project: string, policy: AgentPolicy | 'global') => {
    const newPolicies = { ...localSettings.projectPolicies };
    if (policy === 'global') {
      delete newPolicies[project];
    } else {
      newPolicies[project] = policy;
    }
    updateSettings({ projectPolicies: newPolicies });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--foreground)]">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface)]/50">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[var(--foreground)] transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          {/* Agent Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-[var(--border)] pb-2">Global Agent Policy</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--foreground)]/80">Command execution policy:</label>
                <div className="space-y-2 pl-2">
                  {(['ask', 'safe', 'yolo', 'custom'] as const).map(policy => (
                    <label key={policy} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="agentPolicy"
                        value={policy}
                        checked={localSettings.agentPolicy === policy}
                        onChange={(e) => updateSettings({ agentPolicy: e.target.value as AgentPolicy })}
                        className="text-blue-500 bg-[var(--background)] border-[var(--border)] focus:ring-blue-500"
                      />
                      <span className="text-sm capitalize text-[var(--foreground)]/80">
                        {policy === 'ask' ? 'Ask every time' : policy === 'safe' ? 'Auto approve safe commands' : policy === 'yolo' ? 'Auto approve all (YOLO)' : 'Custom permissions'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {localSettings.agentPolicy === 'custom' && (
                <div className="space-y-2 pl-2 mt-4 p-4 rounded bg-[var(--background)]/50 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-[var(--foreground)]/80 mb-2">Auto-Approve Tools (Read/Write):</label>
                  <p className="text-xs text-[var(--foreground)]/60 mb-3">Select which tools the agent is allowed to use without asking for permission.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'read_file', label: 'Read Files' },
                      { key: 'grep_search', label: 'Grep / Search' },
                      { key: 'list_directory', label: 'List Directories' },
                      { key: 'write_file', label: 'Write Files' },
                      { key: 'replace', label: 'Replace / Edit' },
                      { key: 'run_shell_command', label: 'Run Shell Commands' },
                      { key: 'generalist', label: 'Subagent: Generalist' },
                      { key: 'codebase_investigator', label: 'Subagent: Investigator' },
                      { key: 'cli_help', label: 'Subagent: Help' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localSettings.toolPermissions[key as keyof Settings['toolPermissions']]}
                          onChange={(e) => updateSettings({ 
                            toolPermissions: { 
                              ...localSettings.toolPermissions, 
                              [key]: e.target.checked 
                            } 
                          })}
                          className="rounded-[var(--radius)] bg-[var(--background)] border-[var(--border)] text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-[var(--foreground)]/80">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Project Policies Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-[var(--border)] pb-2">Project Policies</h3>
            <div className="space-y-3">
              {projects.length === 0 ? (
                <p className="text-sm text-[var(--foreground)]/50">No projects found.</p>
              ) : (
                projects.map(project => (
                  <div key={project} className="flex items-center justify-between gap-4 p-2 rounded bg-[var(--background)]/30 border border-[var(--border)]/50">
                    <span className="text-sm font-medium truncate flex-1">{project}</span>
                    <select
                      value={localSettings.projectPolicies[project] || 'global'}
                      onChange={(e) => updateProjectPolicy(project, e.target.value as AgentPolicy | 'global')}
                      style={{ textAlignLast: 'center' }}
                      className="bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:border-blue-500 text-center"
                    >
                      <option value="global">Global ({localSettings.agentPolicy})</option>
                      <option value="ask">Ask every time</option>
                      <option value="safe">Safe commands</option>
                      <option value="yolo">Auto-approve (YOLO)</option>
                    </select>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Chat Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-[var(--border)] pb-2">Chat</h3>
            <div className="space-y-3">
              {[
                { key: 'autoScroll', label: 'Auto scroll to latest message' },
                { key: 'renderMermaid', label: 'Render mermaid diagrams' },
                { key: 'showLogs', label: 'Show raw CLI logs' },
                { key: 'autoTitle', label: 'Auto generate chat titles' },
                { key: 'playSound', label: 'Play notification sound when done' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.chat[key as keyof Settings['chat']]}
                    onChange={(e) => updateSettings({ chat: { ...localSettings.chat, [key]: e.target.checked } })}
                    className="rounded-[var(--radius)] bg-[var(--background)] border-[var(--border)] text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-[var(--foreground)]/80">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Appearance Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400 border-b border-[var(--border)] pb-2">Appearance</h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]/80">UI Mode:</label>
              <select
                value={localSettings.appearance.uiMode}
                onChange={(e) => updateSettings({ appearance: { ...localSettings.appearance, uiMode: e.target.value as UIMode } })}
                style={{ textAlignLast: 'center' }}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-blue-500 transition-colors text-center"
              >
                <option value="gemini">Gemini</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="shadcn">Shadcn Assistant</option>
              </select>
            </div>
          </section>

          {/* Reset Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-red-400 border-b border-[var(--border)] pb-2">Danger Zone</h3>
            <div className="flex gap-4">
              <button
                onClick={onClearChats}
                className="px-4 py-2 bg-red-900/50 text-red-200 hover:bg-red-800/80 rounded-[var(--radius)] text-sm transition-colors border border-red-800"
              >
                Clear all chats
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface)]/80 rounded-[var(--radius)] text-sm transition-colors border border-[var(--border)]"
              >
                Reset all settings
              </button>
            </div>
          </section>
        </div>

        <div className="p-4 bg-[var(--background)]/50 border-t border-[var(--border)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)] rounded-[var(--radius)] text-sm font-bold transition-colors shadow-lg"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
