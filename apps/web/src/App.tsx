import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, Send, Folder, MessageSquare, Plus, Settings as SettingsIcon, Check, X, File as FileIcon, ChevronLeft } from 'lucide-react';
import Mermaid from './components/Mermaid';
import CollapsibleCode from './components/CollapsibleCode';
import SettingsModal, { Settings, defaultSettings } from './components/SettingsModal';
import DiffViewer from './components/DiffViewer';

const API_BASE = typeof window !== 'undefined' ? `http://${window.location.hostname}:4000` : 'http://localhost:4000';
const WS_BASE = typeof window !== 'undefined' ? `ws://${window.location.hostname}:4000` : 'ws://localhost:4000';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  geminiSessionId: string | null;
  model: string;
  updatedAt: string;
};

export default function Home() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cliLogs, setCliLogs] = useState<string[]>([]);
  
  const [input, setInput] = useState('');
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [, setWs] = useState<WebSocket | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);

  // Mention system state
  const [mentionState, setMentionState] = useState<{ active: boolean; query: string; startIndex: number; index: number }>({ active: false, query: '', startIndex: -1, index: 0 });
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);  
  const [model, setModel] = useState('gemini-3.1-pro-preview');

  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gemini_cli_settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse settings', e);
        }
      }
    }
    return defaultSettings;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [confirmData, setConfirmData] = useState<{ 
    message: string; 
    onConfirm: () => void; 
    onCancel: () => void;
    diff?: { oldContent: string; newContent: string; filename: string };
  } | null>(null);

  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [browseEntries, setBrowseEntries] = useState<{name:string, path:string, isDirectory:boolean}[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('gemini_cli_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    fetch(`${API_BASE}/projects`)
      .then(r => r.json())
      .then((data: string[]) => {
        setProjects(data);
        const savedProject = localStorage.getItem('gemini_cli_selected_project');
        if (savedProject && data.includes(savedProject)) {
          setSelectedProject(savedProject);
        } else if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0]);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('gemini_cli_selected_project', selectedProject);
      fetch(`${API_BASE}/projects/${selectedProject}/chats`)
        .then(r => r.json())
        .then((data: Chat[]) => {
          setChats(data);
          const savedChatId = localStorage.getItem('gemini_cli_selected_chat_id');
          if (savedChatId) {
            const found = data.find(c => c.id === savedChatId);
            if (found) {
              setSelectedChat(found);
              return;
            }
          }
          if (data.length > 0 && !selectedChat) {
            setSelectedChat(data[0]);
          } else if (data.length === 0) {
            setSelectedChat(null);
          }
        });
      fetch(`${API_BASE}/projects/${selectedProject}/files`)
        .then(r => r.json())
        .then(setProjectFiles);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedChat) {
      localStorage.setItem('gemini_cli_selected_chat_id', selectedChat.id);
      setMessages(selectedChat.messages);
    } else {
      setMessages([]);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (settings.chat.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingMessage, settings.chat.autoScroll]);

  useEffect(() => {
    if (isAddingProject) {
      fetch(`${API_BASE}/browse${browsePath ? `?path=${encodeURIComponent(browsePath)}` : ''}`)
        .then(r => r.json())
        .then(data => {
          setBrowseEntries(data.entries);
          setBrowsePath(data.currentPath);
          setParentPath(data.parentPath);
        });
    }
  }, [isAddingProject, browsePath]);

  const handleCreateChat = () => {
    if (!selectedProject) return;
    fetch(`${API_BASE}/projects/${selectedProject}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    })
      .then(r => r.json())
      .then(chat => {
        setChats([chat, ...chats]);
        setSelectedChat(chat);
      });
  };

  const handleCreateProject = (externalPath?: string) => {
    const name = externalPath ? externalPath.split(/[\\/]/).pop() || 'project' : newProjectName.trim();
    if (name) {
      fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path: externalPath })
      }).then(() => {
        setProjects([...projects, name]);
        setSelectedProject(name);
        setNewProjectName('');
        setIsAddingProject(false);
      });
    }
  };

  const FALLBACK_MODELS = [
    'gemini-3.1-pro-preview',
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];

  const getNextModel = (currentModel: string) => {
    const idx = FALLBACK_MODELS.indexOf(currentModel);
    if (idx !== -1 && idx < FALLBACK_MODELS.length - 1) {
      return FALLBACK_MODELS[idx + 1];
    }
    return null;
  };

  const handleSend = async (overridePrompt?: string, overrideModel?: string) => {
    if (!selectedChat || !selectedProject) return;
    
    let currentPrompt = overridePrompt;
    if (!currentPrompt) {
      if (!input.trim()) return;
      currentPrompt = input;
      if (attachments.length > 0) {
        for (const filepath of attachments) {
          try {
            const res = await fetch(`${API_BASE}/projects/${selectedProject}/files/content?path=${encodeURIComponent(filepath)}`);
            if (res.ok) {
              const content = await res.text();
              currentPrompt += `\n\nFile: ${filepath}\n\`\`\`\n${content}\n\`\`\``;
            }
          } catch (e) {
            console.error('Failed to attach file', filepath);
          }
        }
      }
      setMessages(prev => [...prev, { role: 'user', content: currentPrompt! }]);
      setSelectedChat(prevChat => prevChat ? { ...prevChat, messages: [...prevChat.messages, { role: 'user', content: currentPrompt! }] } : prevChat);
      setInput('');
      setAttachments([]);
    }

    const currentModel = overrideModel || model;
    setStreamingMessage('');
    setCliLogs([]);
    setIsGenerating(true);

    const socket = new WebSocket(WS_BASE);
    setWs(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'prompt',
        project: selectedProject,
        chatId: selectedChat.id,
        prompt: currentPrompt,
        model: currentModel,
        geminiSessionId: selectedChat.geminiSessionId,
        approve: settings.agentPolicy === 'yolo' ? 'yolo' : 'default',
        autoTitle: settings.chat.autoTitle
      }));
    };

    let assistantContent = '';
    let hasFallbackTriggered = false;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message' && data.role === 'assistant') {
        if (data.delta) {
          assistantContent += data.content;
        } else {
          assistantContent = data.content;
        }
        setStreamingMessage(assistantContent);
      } else if (data.type === 'init' && data.session_id) {
        setSelectedChat(prev => prev ? { ...prev, geminiSessionId: data.session_id } : prev);
      } else if (data.type === 'confirm') {
        setConfirmData({
            message: data.message,
            diff: data.diff,
            onConfirm: () => {
                socket.send(JSON.stringify({ type: 'input', content: 'y' }));
                setConfirmData(null);
            },
            onCancel: () => {
                socket.send(JSON.stringify({ type: 'input', content: 'n' }));
                setConfirmData(null);
            }
        });
      } else if (data.type === 'stderr' || data.type === 'stdout') {
        if (data.content) {
            setCliLogs(prev => [...prev, data.content].slice(-100));
        }
      } else if (data.type === 'done') {
        if (!hasFallbackTriggered) {
          setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
          setSelectedChat(prevChat => prevChat ? { ...prevChat, messages: [...prevChat.messages, { role: 'assistant', content: assistantContent }] } : prevChat);
          setStreamingMessage('');
          setIsGenerating(false);
          socket.close();
        }
      } else if (data.type === 'error' || (data.type === 'result' && data.status === 'error')) {
        const errorMsg = data.error?.message || data.error || 'Unknown error';
        const isQuotaError = errorMsg.toLowerCase().includes('resource has been exhausted') || 
                            errorMsg.includes('429') || 
                            errorMsg.toLowerCase().includes('quota');

        if (isQuotaError) {
          const nextModel = getNextModel(currentModel);
          if (nextModel) {
            hasFallbackTriggered = true;
            console.warn(`Quota hit on ${currentModel}. Falling back to ${nextModel}.`);
            setModel(nextModel);
            socket.close();
            setMessages(prev => [...prev, { role: 'assistant', content: `_⚠️ Quota hit on ${currentModel}. Retrying with ${nextModel}..._` }]);
            setSelectedChat(prevChat => prevChat ? { ...prevChat, messages: [...prevChat.messages, { role: 'assistant', content: `_⚠️ Quota hit on ${currentModel}. Retrying with ${nextModel}..._` }] } : prevChat);
            handleSend(currentPrompt, nextModel);
            return;
          }
        }

        setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${errorMsg}` }]);
        setSelectedChat(prevChat => prevChat ? { ...prevChat, messages: [...prevChat.messages, { role: 'assistant', content: `**Error:** ${errorMsg}` }] } : prevChat);
        setIsGenerating(false);
        socket.close();
      } else if (data.type === 'stderr') {
        console.warn('stderr:', data.content);
      }
    };

    socket.onerror = () => {
      if (!hasFallbackTriggered) setIsGenerating(false);
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtPos !== -1) {
      // Check if @ is preceded by a space or is at the very beginning
      if (lastAtPos === 0 || val[lastAtPos - 1] === ' ' || val[lastAtPos - 1] === '\n') {
        const query = textBeforeCursor.slice(lastAtPos + 1);
        if (!query.includes(' ') && !query.includes('\n')) {
          setMentionState(prev => ({ ...prev, active: true, query, startIndex: lastAtPos, index: 0 }));
          
          if (!query) {
            setFilteredFiles(projectFiles.slice(0, 10)); // show some defaults if query is empty
          } else {
            const lowerQuery = query.toLowerCase();
            const matches = projectFiles.filter(f => f.toLowerCase().includes(lowerQuery));
            // prioritize exact matches in filename
            matches.sort((a, b) => {
               const aName = a.split('/').pop()?.toLowerCase() || '';
               const bName = b.split('/').pop()?.toLowerCase() || '';
               const aStarts = aName.startsWith(lowerQuery);
               const bStarts = bName.startsWith(lowerQuery);
               if (aStarts && !bStarts) return -1;
               if (!aStarts && bStarts) return 1;
               return a.length - b.length;
            });
            setFilteredFiles(matches.slice(0, 10)); // max 10 suggestions
          }
          return;
        }
      }
    }
    
    setMentionState(prev => ({ ...prev, active: false }));
  };

  const selectMention = (filepath: string) => {
    if (!mentionState.active) return;
    
    // Replace the `@query` with the filepath
    const before = input.slice(0, mentionState.startIndex);
    const after = input.slice(mentionState.startIndex + mentionState.query.length + 1);
    
    setInput(`${before}@${filepath} ${after}`);
    
    // Also auto-add to attachments if not already there
    if (!attachments.includes(filepath)) {
      setAttachments(prev => [...prev, filepath]);
    }
    
    setMentionState(prev => ({ ...prev, active: false }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState.active && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionState(prev => ({ ...prev, index: (prev.index + 1) % filteredFiles.length }));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionState(prev => ({ ...prev, index: (prev.index - 1 + filteredFiles.length) % filteredFiles.length }));
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(filteredFiles[mentionState.index]);
        return;
      } else if (e.key === 'Escape') {
        setMentionState(prev => ({ ...prev, active: false }));
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const toggleAttachment = (filepath: string) => {
    if (attachments.includes(filepath)) {
      setAttachments(attachments.filter(p => p !== filepath));
    } else {
      setAttachments([...attachments, filepath]);
    }
  };

  return (
    <div className={`flex h-screen font-sans theme-${settings.appearance.theme} ${settings.appearance.theme === 'light' ? 'bg-gray-50 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
      {/* Sidebar */}
      <div className={`w-64 border-r flex flex-col ${settings.appearance.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
        <div className={`p-4 border-b ${settings.appearance.theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
          <h1 className="text-xl font-bold flex items-center gap-2 cursor-pointer" onClick={() => setShowSettings(true)}>
            <SettingsIcon className="w-5 h-5" /> Gemini CLI UI
          </h1>
        </div>
        
        {/* Projects */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Projects</h2>
              <button onClick={() => setIsAddingProject(true)} className="text-gray-400 hover:text-white"><Plus className="w-4 h-4" /></button>
            </div>
            <ul className="space-y-1">
              {projects.map(p => (
                <li key={p}>
                  <button 
                    onClick={() => { setSelectedProject(p); setSelectedChat(null); }}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded ${selectedProject === p ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                  >
                    <Folder className="w-4 h-4" /> {p}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* New Project Modal */}
          {isAddingProject && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className={`border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] ${settings.appearance.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${settings.appearance.theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
                  <h3 className="text-lg font-semibold">Add Project</h3>
                  <button onClick={() => setIsAddingProject(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-4 flex flex-col gap-4 overflow-hidden">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Create New Empty Project</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                        placeholder="Project Name"
                        className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors ${settings.appearance.theme === 'light' ? 'bg-gray-100 border-gray-300' : 'bg-gray-900 border-gray-700 text-white'}`}
                      />
                      <button 
                        onClick={() => handleCreateProject()}
                        disabled={!newProjectName.trim()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                      >
                        Create
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col overflow-hidden">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Or Select Existing Folder</label>
                    <div className={`rounded-lg border flex flex-col overflow-hidden ${settings.appearance.theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-900 border-gray-700'}`}>
                      <div className={`p-2 border-b flex items-center gap-2 text-xs text-gray-400 ${settings.appearance.theme === 'light' ? 'bg-gray-100 border-gray-200' : 'bg-gray-800/30 border-gray-700'}`}>
                        <button 
                          onClick={() => parentPath && setBrowsePath(parentPath)}
                          disabled={!parentPath}
                          className="p-1 hover:text-white disabled:opacity-30"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="truncate flex-1 font-mono">{browsePath}</span>
                      </div>
                      <div className="overflow-y-auto flex-1 p-1 min-h-[200px]">
                        {browseEntries.map(entry => (
                          <div 
                            key={entry.path}
                            className={`flex items-center justify-between p-2 rounded group transition-colors cursor-default ${settings.appearance.theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-gray-800'}`}
                          >
                            <div 
                              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                              onClick={() => entry.isDirectory ? setBrowsePath(entry.path) : null}
                            >
                              <Folder className={`w-4 h-4 shrink-0 ${entry.isDirectory ? 'text-blue-400' : 'text-gray-500'}`} />
                              <span className={`text-sm truncate ${entry.isDirectory ? (settings.appearance.theme === 'light' ? 'text-gray-900' : 'text-gray-200') : 'text-gray-500'}`}>{entry.name}</span>
                            </div>
                            {entry.isDirectory && (
                              <button 
                                onClick={() => handleCreateProject(entry.path)}
                                className="opacity-0 group-hover:opacity-100 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded text-xs transition-all"
                              >
                                Select Folder
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 flex justify-end ${settings.appearance.theme === 'light' ? 'bg-gray-50' : 'bg-gray-900/50'}`}>
                  <button 
                    onClick={() => setIsAddingProject(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chats */}
          {selectedProject && (
            <div className={`p-4 border-t ${settings.appearance.theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Chats</h2>
                <button onClick={handleCreateChat} className="text-gray-400 hover:text-white"><Plus className="w-4 h-4" /></button>
              </div>
              <ul className="space-y-1">
                {chats.map(c => (
                  <li key={c.id}>
                    <button 
                      onClick={() => setSelectedChat(c)}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm truncate ${selectedChat?.id === c.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={`h-14 border-b flex items-center justify-between px-6 ${settings.appearance.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
          <div className="font-semibold text-lg truncate">
            {selectedProject ? `${selectedProject} / ${selectedChat?.title || 'No chat selected'}` : 'Select a project'}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-gray-400">Model:</span>
              <select value={model} onChange={e => setModel(e.target.value)} className={`border-none rounded px-2 py-1 ${settings.appearance.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-700 text-white'}`}>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
              </select>
            </label>
          </div>
        </header>

        {/* Chat Messages */}
        <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${settings.appearance.theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'}`}>
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} theme={settings.appearance.theme} renderMermaid={settings.chat.renderMermaid} />
          ))}
          {isGenerating && !streamingMessage && (
            <div className={`flex gap-4 max-w-4xl mx-auto ${settings.appearance.theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-purple-600 text-white">
                G
              </div>
              <div className="flex-1 space-y-2 overflow-hidden">
                <div className={`inline-block text-left rounded-2xl px-5 py-3 max-w-full overflow-x-auto ${settings.appearance.theme === 'light' ? 'bg-white border border-gray-200 text-gray-400' : 'bg-gray-800 text-gray-400'}`}>
                  <div className="flex space-x-1.5 items-center h-6">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {streamingMessage && (
            <MessageBubble message={{ role: 'assistant', content: streamingMessage }} isStreaming theme={settings.appearance.theme} renderMermaid={settings.chat.renderMermaid} />
          )}
          
          {settings.chat.showLogs && cliLogs.length > 0 && (
            <div className={`mt-4 p-4 rounded-lg font-mono text-xs overflow-x-auto ${settings.appearance.theme === 'light' ? 'bg-gray-100 border border-gray-200' : 'bg-black/40 border border-gray-800'}`}>
                <div className="text-gray-500 mb-2 font-bold uppercase tracking-wider text-[10px]">Raw CLI Logs</div>
                {cliLogs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap text-gray-400 border-l-2 border-gray-700 pl-2 mb-1">{log}</div>
                ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`p-4 border-t ${settings.appearance.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map(att => (
                  <div key={att} className="flex items-center gap-1 bg-blue-900/50 text-blue-200 px-2 py-1 rounded text-xs border border-blue-700">
                    <FileIcon className="w-3 h-3" />
                    <span className="truncate max-w-[200px]">{att}</span>
                    <button onClick={() => toggleAttachment(att)} className="hover:text-white"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            
            <div className={`relative flex items-end gap-2 p-2 rounded-xl border focus-within:border-blue-500 transition-colors shadow-sm ${settings.appearance.theme === 'light' ? 'bg-gray-50 border-gray-300' : 'bg-gray-900 border-gray-700'}`}>
              <div className="relative">
                <button 
                  onClick={() => setShowFilePicker(!showFilePicker)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                {showFilePicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 max-h-64 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 z-10">
                    <div className="text-xs font-semibold text-gray-400 mb-2 px-2">Attach Files</div>
                    {projectFiles.length === 0 ? (
                      <div className="text-xs text-gray-500 px-2">No files found</div>
                    ) : (
                      projectFiles.map(f => (
                        <button 
                          key={f} 
                          onClick={() => { toggleAttachment(f); setShowFilePicker(false); }}
                          className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded truncate flex items-center justify-between"
                        >
                          <span className="truncate">{f}</span>
                          {attachments.includes(f) && <Check className="w-4 h-4 text-blue-500" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={selectedChat ? "Type your prompt here... (@ to mention file, Shift+Enter for newline)" : "Select or create a chat to begin..."}
                disabled={!selectedChat || isGenerating}
                className="flex-1 max-h-64 min-h-[44px] bg-transparent border-none focus:outline-none resize-none py-3 text-sm scrollbar-thin placeholder-gray-500 relative"
                rows={Math.min(10, input.split('\n').length)}
              />

              {mentionState.active && (
                <div className="absolute bottom-full mb-2 left-10 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                  <div className="p-2 border-b border-gray-700 text-xs font-semibold text-gray-400 bg-gray-900/50">
                    Mention File
                  </div>
                  <ul className="max-h-60 overflow-y-auto p-1">
                    {filteredFiles.length > 0 ? (
                      filteredFiles.map((f, i) => (
                        <li key={f}>
                          <button
                            onClick={() => selectMention(f)}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 truncate ${
                              i === mentionState.index ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            <FileIcon className="w-4 h-4 shrink-0 opacity-70" />
                            <span className="truncate">{f}</span>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-4 text-center text-sm text-gray-500">No matching files found</li>
                    )}
                  </ul>
                </div>
              )}

              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || !selectedChat || isGenerating}
                className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                  input.trim() && selectedChat && !isGenerating 
                    ? 'bg-blue-600 text-white hover:bg-blue-500' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center text-xs text-gray-500 mt-1">
              Gemini CLI Web Interface. Model outputs may be inaccurate.
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
            settings={settings}
            setSettings={setSettings}
            onClose={() => setShowSettings(false)}
            onClearChats={() => {
                if (confirm('Are you sure you want to clear all chats for this project?')) {
                    fetch(`${API_BASE}/projects/${selectedProject}/chats`, { method: 'DELETE' })
                      .then(() => {
                        setChats([]);
                        setSelectedChat(null);
                        setMessages([]);
                      });
                }
            }}
        />
      )}

      {confirmData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className={`border rounded-xl shadow-2xl w-full p-6 ${confirmData.diff ? 'max-w-6xl' : 'max-w-md'} ${settings.appearance.theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                <h3 className="text-lg font-bold mb-4">Command Approval</h3>
                <div className={`p-3 rounded-lg font-mono text-sm mb-4 ${settings.appearance.theme === 'light' ? 'bg-gray-100' : 'bg-gray-900'}`}>
                    {confirmData.message}
                </div>

                {confirmData.diff && (
                    <DiffViewer
                        oldValue={confirmData.diff.oldContent}
                        newValue={confirmData.diff.newContent}
                        filename={confirmData.diff.filename}
                        splitView={true}
                    />
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={confirmData.onCancel} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                        {confirmData.diff ? 'Reject changes' : 'Cancel'}
                    </button>
                    <button onClick={confirmData.onConfirm} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold text-white transition-all shadow-lg shadow-blue-900/20">
                        {confirmData.diff ? 'Accept changes' : 'Approve'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, isStreaming = false, theme = 'dark', renderMermaid = true }: { message: Message, isStreaming?: boolean, theme?: string, renderMermaid?: boolean }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-4 max-w-4xl mx-auto ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white ${isUser ? 'bg-blue-600' : 'bg-purple-600'}`}>
        {isUser ? 'U' : 'G'}
      </div>
      <div className={`flex-1 space-y-2 overflow-hidden ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block text-left rounded-2xl px-5 py-3 max-w-full overflow-x-auto ${isUser ? 'bg-blue-600/20 text-blue-50' : (theme === 'light' ? 'bg-white border border-gray-200 text-gray-900' : 'bg-gray-800 text-gray-100')}`}>
          <div className={`prose prose-invert max-w-none ${isUser ? 'prose-p:my-0' : ''} ${theme === 'light' ? 'prose-gray prose-p:text-gray-900 prose-headings:text-gray-900' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
              code({node, inline, className, children, ...props}: any) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                const codeString = String(children).replace(/\n$/, '');

                if (!inline && language === 'mermaid' && renderMermaid) {
                  return <Mermaid chart={codeString} />;
                }

                return !inline && match ? (
                  <CollapsibleCode language={language} value={codeString} />
                ) : (
                  <code {...props} className="bg-gray-900 text-pink-300 px-1 py-0.5 rounded text-sm">
                    {children}
                  </code>
                )
              }
            }}
          >
            {message.content + (isStreaming ? '...' : '')}
          </ReactMarkdown>
          </div>
          </div>
          </div>    </div>
  );
}
