import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Folder, MessageSquare, Plus, Settings as SettingsIcon, X, ChevronLeft, ArrowDown, Trash2, Sun, Moon } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import GeminiLogo from './components/GeminiLogo';
import { Settings, defaultSettings } from './types/settings';
import { UI_MODES } from './ui-modes';
import { ShadcnSidebar, ShadcnHeader, ShadcnSuggestions } from './ui-modes/shadcn';
import DiffViewer from './components/DiffViewer';

const API_BASE = typeof window !== 'undefined' ? `http://${window.location.hostname}:4000` : 'http://localhost:4000';
const WS_BASE = typeof window !== 'undefined' ? `ws://${window.location.hostname}:4000` : 'ws://localhost:4000';

type Message = { role: 'user' | 'assistant'; content: string; };
type Chat = { id: string; title: string; messages: Message[]; geminiSessionId: string | null; model: string; updatedAt: string; };

export default function Home() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cliLogs, setCliLogs] = useState<string[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [lastRawLog, setLastRawLog] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [model, setModel] = useState('gemini-3.1-pro-preview');
  const [fallbackStatus, setFallbackStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gemini_cli_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return { ...defaultSettings, ...parsed, chat: { ...defaultSettings.chat, ...(parsed.chat || {}) }, appearance: { ...defaultSettings.appearance, ...(parsed.appearance || {}) } };
        } catch (e) { console.error('Failed to parse settings', e); }
      }
    }
    return defaultSettings;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void; onCancel: () => void; diff?: { oldContent: string; newContent: string; filename: string }; } | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [browseEntries, setBrowseEntries] = useState<{name:string, path:string, isDirectory:boolean}[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('gemini_cli_settings', JSON.stringify(settings));
    const applyTheme = (theme: string) => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
    };
    applyTheme(settings.appearance.theme);
    if (settings.appearance.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => { document.documentElement.classList.toggle('dark', e.matches); };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings]);

  const toggleTheme = useCallback((event: React.MouseEvent) => {
    // @ts-ignore
    if (!document.startViewTransition) {
      setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, theme: prev.appearance.theme === 'dark' ? 'light' : 'dark' } }));
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    // @ts-ignore
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setSettings(prev => ({ ...prev, appearance: { ...prev.appearance, theme: prev.appearance.theme === 'dark' ? 'light' : 'dark' } }));
      });
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);

  const playNotificationSound = useCallback(() => {
    if (!settings.chat.playSound) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error('Failed to play sound', e);
    }
  }, [settings.chat.playSound]);

  useEffect(() => {
    fetch(`${API_BASE}/projects`).then(r => r.json()).then((data: string[]) => {
      setProjects(data);
      const savedProject = localStorage.getItem('gemini_cli_selected_project');
      if (savedProject && data.includes(savedProject)) setSelectedProject(savedProject);
      else if (data.length > 0 && !selectedProject) setSelectedProject(data[0]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('gemini_cli_selected_project', selectedProject);
      fetch(`${API_BASE}/projects/${selectedProject}/chats`).then(r => r.json()).then((data: Chat[]) => {
        setChats(data);
        const savedChatId = localStorage.getItem('gemini_cli_selected_chat_id');
        if (savedChatId) {
          const found = data.find(c => c.id === savedChatId);
          if (found) { setSelectedChat(found); return; }
        }
        if (data.length > 0 && !selectedChat) setSelectedChat(data[0]);
        else if (data.length === 0) setSelectedChat(null);
      });
      fetch(`${API_BASE}/projects/${selectedProject}/files`).then(r => r.json()).then(setProjectFiles);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedChat) {
      localStorage.setItem('gemini_cli_selected_chat_id', selectedChat.id);
      setMessages(selectedChat.messages);
      setTimeout(scrollToBottom, 50);
    } else setMessages([]);
  }, [selectedChat, scrollToBottom]);

  useEffect(() => {
    if (settings.chat.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: isGenerating ? 'auto' : 'smooth' });
    }
  }, [messages, streamingMessage, settings.chat.autoScroll, isGenerating]);

  useEffect(() => {
    if (isAddingProject) {
      fetch(`${API_BASE}/browse${browsePath ? `?path=${encodeURIComponent(browsePath)}` : ''}`).then(r => r.json()).then(data => {
        setBrowseEntries(data.entries);
        setBrowsePath(data.currentPath);
        setParentPath(data.parentPath);
      });
    }
  }, [isAddingProject, browsePath]);

  const handleCreateChat = useCallback(() => {
    if (!selectedProject) return;
    fetch(`${API_BASE}/projects/${selectedProject}/chats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) }).then(r => r.json()).then(chat => {
      setChats(prev => [chat, ...prev]);
      setSelectedChat(chat);
    });
  }, [selectedProject, model]);

  const handleCreateProject = useCallback((externalPath?: string) => {
    const name = externalPath ? externalPath.split(/[\\/]/).pop() || 'project' : newProjectName.trim();
    if (name) {
      fetch(`${API_BASE}/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, path: externalPath }) }).then(() => {
        setProjects(prev => [...prev, name]);
        setSelectedProject(name);
        setNewProjectName('');
        setIsAddingProject(false);
      });
    }
  }, [newProjectName]);

  const FALLBACK_MODELS = ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const getNextModel = useCallback((currentModel: string) => {
    const idx = FALLBACK_MODELS.indexOf(currentModel);
    if (idx !== -1 && idx < FALLBACK_MODELS.length - 1) return FALLBACK_MODELS[idx + 1];
    return null;
  }, []);

  const handleSend = useCallback(async (promptText: string, overrideModel?: string, isRegenerating = false) => {
    if (!selectedChat || !selectedProject || !promptText.trim()) return;
    if (!overrideModel) setFallbackStatus(null);

    setMessages(prev => {
        const isRetrying = prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].content === promptText;
        if (isRetrying || isRegenerating) return prev;
        return [...prev, { role: 'user', content: promptText }];
    });

    if (!isRegenerating) {
      setSelectedChat(prev => {
        if (!prev) return prev;
        const isRetrying = prev.messages.length > 0 && prev.messages[prev.messages.length - 1].role === 'user' && prev.messages[prev.messages.length - 1].content === promptText;
        if (isRetrying) return prev;
        return { ...prev, messages: [...prev.messages, { role: 'user', content: promptText }] };
      });
    }
    
    setIsGenerating(true);
    setStreamingMessage('');
    setCliLogs([]);
    setLastRawLog(null);

    const currentModel = overrideModel || model;
    const socket = new WebSocket(WS_BASE);
    setWs(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'prompt', project: selectedProject, chatId: selectedChat.id, prompt: promptText, model: currentModel,
        geminiSessionId: selectedChat.geminiSessionId,
        approve: settings.agentPolicy,
        toolPermissions: settings.toolPermissions,
        autoTitle: settings.chat.autoTitle,

        isRetry: !!overrideModel || isRegenerating
      }));
    };

    let assistantContent = '';
    let hasFallbackTriggered = false;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message' && data.role === 'assistant') {
        if (data.delta) assistantContent += data.content;
        else assistantContent = data.content;
        setStreamingMessage(assistantContent);
      } else if (data.type === 'init' && data.session_id) {
        setSelectedChat(prev => prev ? { ...prev, geminiSessionId: data.session_id } : prev);
      } else if (data.type === 'title_update' && data.title) {
        setChats(prev => prev.map(c => c.id === data.chatId ? { ...c, title: data.title } : c));
        setSelectedChat(prev => (prev && prev.id === data.chatId) ? { ...prev, title: data.title } : prev);
      } else if (data.type === 'tool_use') {
        setActiveTool(`Running ${data.tool_name}...`);
      } else if (data.type === 'tool_result') {
        setActiveTool(null);
      } else if (data.type === 'confirm') {
        setConfirmData({
            message: data.message, diff: data.diff,
            onConfirm: () => { socket.send(JSON.stringify({ type: 'input', content: 'y' })); setConfirmData(null); },
            onCancel: () => { socket.send(JSON.stringify({ type: 'input', content: 'n' })); setConfirmData(null); }
        });
      } else if (data.type === 'stderr' || data.type === 'stdout') {
        if (data.content) {
          setCliLogs(prev => [...prev, data.content].slice(-100));
          if (data.type === 'stdout') setLastRawLog(data.content);
        }
      } else if (data.type === 'done') {
        setFallbackStatus(null);
        setActiveTool(null);
        playNotificationSound();
        if (!hasFallbackTriggered) {
          setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
          setSelectedChat(prevChat => prevChat ? { ...prevChat, messages: [...prevChat.messages, { role: 'assistant', content: assistantContent }] } : prevChat);
          setStreamingMessage('');
          setIsGenerating(false);
          socket.close();
        }
      } else if (data.type === 'error' || (data.type === 'result' && data.status === 'error')) {
        const errorMsg = data.error?.message || data.error || 'Unknown error';
        setActiveTool(null);
        if (errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429')) {
          const nextModel = getNextModel(currentModel);
          if (nextModel) {
            hasFallbackTriggered = true;
            setFallbackStatus(`Falling back to ${nextModel}...`);
            setModel(nextModel);
            socket.close();
            handleSend(promptText, nextModel, isRegenerating);
            return;
          }
        }
        setFallbackStatus(null);
        setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${errorMsg}` }]);
        setIsGenerating(false);
        socket.close();
      }
    };
    socket.onerror = () => { 
      setActiveTool(null);
      if (!hasFallbackTriggered) setIsGenerating(false); 
    };
  }, [selectedChat, selectedProject, model, messages, settings.agentPolicy, settings.chat.autoTitle, getNextModel]);

  const handleStop = useCallback(() => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'stop' }));
      setIsGenerating(false);
      setStreamingMessage('');
      setActiveTool(null);
      setLastRawLog(null);
    }
  }, [ws]);

  const handleRetry = useCallback((index: number) => {
    if (isGenerating) return;
    const userMessage = messages[index];
    if (userMessage.role !== 'user') return;
    const newMessages = messages.slice(0, index + 1);
    setMessages(newMessages);
    if (selectedChat) setSelectedChat({ ...selectedChat, messages: newMessages });
    handleSend(userMessage.content, undefined, true);
  }, [messages, isGenerating, selectedChat, handleSend]);

  const handleDeleteChat = useCallback((e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!selectedProject) return;
    if (confirm('Are you sure you want to delete this chat?')) {
      fetch(`${API_BASE}/projects/${selectedProject}/chats/${chatId}`, { method: 'DELETE' }).then(() => {
        setChats(prev => prev.filter(c => c.id !== chatId));
        if (selectedChat?.id === chatId) { setSelectedChat(null); setMessages([]); }
      });
    }
  }, [selectedProject, selectedChat]);

  const { ChatLayout, MessageBubble, ChatInput } = UI_MODES[settings.appearance.uiMode || 'gemini'];
  const isShadcn = settings.appearance.uiMode === 'shadcn';

  const sidebar = useMemo(() => isShadcn ? (
    <ShadcnSidebar projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} setIsAddingProject={setIsAddingProject} chats={chats} selectedChat={selectedChat} setSelectedChat={setSelectedChat} handleCreateChat={handleCreateChat} handleDeleteChat={handleDeleteChat} setShowSettings={setShowSettings} />
  ) : (
    <>
      <div className="h-14 px-4 border-b border-[var(--border)] flex items-center"><h1 className="text-xl font-bold flex items-center gap-2">Gemini CLI UI</h1></div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4"><div className="flex justify-between items-center mb-2"><h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Projects</h2><button onClick={() => setIsAddingProject(true)} className="text-gray-400 hover:text-[var(--foreground)]"><Plus className="w-4 h-4" /></button></div>
          <ul className="space-y-1">{projects.map(p => (<li key={p}><button onClick={() => { setSelectedProject(p); setSelectedChat(null); }} className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded ${selectedProject === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}><Folder className="w-4 h-4" /> {p}</button></li>))}</ul>
        </div>
        {selectedProject && (
          <div className="p-4 border-t border-[var(--border)]"><div className="flex justify-between items-center mb-2"><h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Chats</h2><button onClick={handleCreateChat} className="text-gray-400 hover:text-[var(--foreground)]"><Plus className="w-4 h-4" /></button></div>
            <ul className="space-y-1">{chats.map(c => (<li key={c.id} className="group relative"><button onClick={() => setSelectedChat(c)} className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm truncate pr-8 ${selectedChat?.id === c.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}><MessageSquare className="w-4 h-4 shrink-0" /><span className="truncate">{c.title}</span></button><button onClick={(e) => handleDeleteChat(e, c.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white hover:bg-red-600/80 rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-sm" title="Delete chat"><Trash2 className="w-3.5 h-3.5" /></button></li>))}</ul>
          </div>
        )}
      </div>
      <div className="mt-auto p-4 border-t border-[var(--border)]"><button onClick={() => setShowSettings(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[var(--foreground)] w-full transition-colors p-2 rounded hover:bg-[var(--surface)]"><SettingsIcon className="w-4 h-4" /> Settings</button></div>
    </>
  ), [isShadcn, projects, selectedProject, setIsAddingProject, chats, selectedChat, handleCreateChat, handleDeleteChat, setShowSettings]);

  const header = useMemo(() => isShadcn ? (
    <ShadcnHeader model={model} setModel={setModel} fallbackStatus={fallbackStatus} toggleTheme={toggleTheme} theme={settings.appearance.theme} />
  ) : (
    <header className="h-14 border-b flex items-center justify-between px-6 bg-[var(--surface)] border-[var(--border)]">
      <div className="font-semibold text-lg truncate">{selectedProject ? `${selectedProject} / ${selectedChat?.title || 'No chat selected'}` : 'Select a project'}</div>
      <div className="flex items-center gap-4 text-sm">
        {fallbackStatus && <span className="text-amber-500 animate-pulse font-medium mr-2 flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span>{fallbackStatus}</span>}
        <label className="flex items-center gap-2 cursor-pointer"><span className="text-gray-400">Model:</span><select value={model} onChange={e => setModel(e.target.value)} className="border-none rounded px-2 py-1 bg-[var(--background)] text-[var(--foreground)]"><option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option><option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option><option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option><option value="gemini-2.5-pro">Gemini 2.5 Pro</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option></select></label>
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-[var(--surface)] transition-colors text-gray-400 hover:text-[var(--foreground)]" title={`Switch to ${settings.appearance.theme === 'dark' ? 'light' : 'dark'} mode`}>{settings.appearance.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
      </div>
    </header>
  ), [isShadcn, model, fallbackStatus, toggleTheme, settings.appearance.theme, selectedProject, selectedChat]);

  const messagesContent = (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      <div ref={scrollRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto p-6 space-y-6 ${isShadcn ? 'w-full px-4' : ''}`}>
        {isShadcn && messages.length === 0 && selectedChat && !isGenerating && ( <ShadcnSuggestions onSelect={(text: string) => handleSend(text)} /> )}
        {messages.map((m, i) => ( <MessageBubble key={i} index={i} message={m} renderMermaid={settings.chat.renderMermaid} onRetry={m.role === 'user' ? handleRetry : undefined} /> ))}
        {isGenerating && !streamingMessage && (
          <div className="flex w-full mb-6 px-4 justify-start">
            <div className="flex gap-4 w-full max-w-[85%] flex-row">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-purple-600 text-white relative">
                <GeminiLogo className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-block bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="relative w-4 h-4 mr-1">
                      <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                    <span className="text-sm font-medium text-blue-500 dark:text-blue-400">
                      {activeTool || lastRawLog || 'Gemini is crafting a response...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {streamingMessage && <MessageBubble message={{ role: 'assistant', content: streamingMessage }} index={messages.length} isStreaming renderMermaid={settings.chat.renderMermaid} />}
        <RawLogsViewer logs={cliLogs} show={settings.chat.showLogs} />
        <div ref={messagesEndRef} />
      </div>
      {showScrollButton && <button onClick={scrollToBottom} className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 transition-all animate-in fade-in slide-in-from-bottom-2 z-10" title="Scroll to bottom"><ArrowDown className="w-5 h-5" /></button>}
    </div>
  );

  return (
    <ChatLayout sidebar={sidebar} header={header} messages={messagesContent} input={<ChatInputSection ChatInput={ChatInput} onSend={handleSend} onStop={handleStop} isGenerating={isGenerating} selectedChat={selectedChat} projectFiles={projectFiles} selectedProject={selectedProject} />}>
      {showSettings && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} onClearChats={() => { if (confirm('Are you sure you want to clear all chats for this project?')) { fetch(`${API_BASE}/projects/${selectedProject}/chats`, { method: 'DELETE' }).then(() => { setChats([]); setSelectedChat(null); setMessages([]); }); } }} />}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="border rounded-[var(--radius)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]"><div className="p-4 border-b flex justify-between items-center bg-[var(--surface)] border-[var(--border)]"><h3 className="text-lg font-semibold">Add Project</h3><button onClick={() => setIsAddingProject(false)} className="text-gray-400 hover:text-[var(--foreground)]"><X className="w-5 h-5" /></button></div><div className="p-4 flex flex-col gap-4 overflow-hidden"><div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Create New Empty Project</label><div className="flex gap-2"><input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} placeholder="Project Name" className="flex-1 border rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]" /><button onClick={() => handleCreateProject()} disabled={!newProjectName.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-[var(--radius)] text-sm font-medium transition-colors text-white">Create</button></div></div><div className="flex-1 flex flex-col overflow-hidden"><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Or Select Existing Folder</label><div className="rounded-[var(--radius)] border flex flex-col overflow-hidden bg-[var(--background)] border-[var(--border)]"><div className="p-2 border-b flex items-center gap-2 text-xs text-gray-400 bg-[var(--surface)] border-[var(--border)]"><button onClick={() => parentPath && setBrowsePath(parentPath)} disabled={!parentPath} className="p-1 hover:text-[var(--foreground)] disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button><span className="truncate flex-1 font-mono">{browsePath}</span></div><div className="overflow-y-auto flex-1 p-1 min-h-[200px]">{browseEntries.map(entry => (<div key={entry.path} className="flex items-center justify-between p-2 rounded group transition-colors cursor-default hover:bg-[var(--surface)]"><div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => entry.isDirectory ? setBrowsePath(entry.path) : null}><Folder className={`w-4 h-4 shrink-0 ${entry.isDirectory ? 'text-blue-400' : 'text-gray-500'}`} /><span className={`text-sm truncate ${entry.isDirectory ? 'text-[var(--foreground)]' : 'text-gray-500'}`}>{entry.name}</span></div>{entry.isDirectory && <button onClick={() => handleCreateProject(entry.path)} className="opacity-0 group-hover:opacity-100 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded text-xs transition-all">Select Folder</button>}</div>))}</div></div></div></div><div className="p-4 flex justify-end bg-[var(--background)]/50"><button onClick={() => setIsAddingProject(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-[var(--foreground)] transition-colors">Cancel</button></div></div></div>
      )}
      {confirmData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"><div className={`border rounded-[var(--radius)] shadow-2xl w-full p-6 ${confirmData.diff ? 'max-w-[90vw]' : 'max-w-md'} bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]`}><h3 className="text-lg font-bold mb-4">Command Approval</h3><div className="p-3 rounded-[var(--radius)] font-mono text-sm mb-4 bg-[var(--background)] border border-[var(--border)]">{confirmData.message}</div>{confirmData.diff ? <DiffViewer oldValue={confirmData.diff.oldContent} newValue={confirmData.diff.newContent} filename={confirmData.diff.filename} showActions={true} onAccept={confirmData.onConfirm} onReject={confirmData.onCancel} /> : <div className="flex justify-end gap-3 mt-6"><button onClick={confirmData.onCancel} className="px-4 py-2 text-gray-400 hover:text-[var(--foreground)] transition-colors">Cancel</button><button onClick={confirmData.onConfirm} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-[var(--radius)] font-bold text-white transition-all shadow-lg shadow-blue-900/20">Approve</button></div>}</div></div>
      )}
    </ChatLayout>
  );
}

const RawLogsViewer = React.memo(({ logs, show }: { logs: string[], show: boolean }) => {
  if (!show || logs.length === 0) return null;
  return (
    <div className="mt-4 p-4 rounded-lg font-mono text-xs overflow-x-auto bg-black/40 border border-[var(--border)]">
      <div className="text-gray-500 mb-2 font-bold uppercase tracking-wider text-[10px]">Raw CLI Logs</div>
      {logs.map((log, i) => (
        <div key={i} className="whitespace-pre-wrap text-gray-400 border-l-2 border-[var(--border)] pl-2 mb-1">{log}</div>
      ))}
    </div>
  );
});

function ChatInputSection({ ChatInput, onSend, onStop, isGenerating, selectedChat, projectFiles }: any) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [mentionState, setMentionState] = useState({ active: false, query: '', startIndex: -1, index: 0 });
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);

  const handleSendAction = async (text?: string) => {
    const finalPrompt = text || input;
    if (!finalPrompt.trim()) return;
    let fullPrompt = finalPrompt;
    if (attachments.length > 0) fullPrompt += "\n\nReferenced files:\n" + attachments.map(att => `- ${att}`).join('\n');
    onSend(fullPrompt); setInput(''); setAttachments([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value; setInput(val);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    if (lastAtPos !== -1 && (lastAtPos === 0 || val[lastAtPos - 1] === ' ' || val[lastAtPos - 1] === '\n')) {
      const query = textBeforeCursor.slice(lastAtPos + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionState(prev => ({ ...prev, active: true, query, startIndex: lastAtPos, index: 0 }));
        if (!query) setFilteredFiles((projectFiles as string[]).slice(0, 10));
        else {
          const lowerQuery = query.toLowerCase();
          const matches = (projectFiles as string[]).filter((f: string) => f.toLowerCase().includes(lowerQuery)).sort((a: string, b: string) => {
             const aName = a.split('/').pop()?.toLowerCase() || '';
             const bName = b.split('/').pop()?.toLowerCase() || '';
             if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery)) return -1;
             if (!aName.startsWith(lowerQuery) && bName.startsWith(lowerQuery)) return 1;
             return a.length - b.length;
          });
          setFilteredFiles(matches.slice(0, 10));
        }
        return;
      }
    }
    setMentionState(prev => ({ ...prev, active: false }));
  };

  const selectMention = (filepath: string) => {
    const before = input.slice(0, mentionState.startIndex);
    const after = input.slice(mentionState.startIndex + mentionState.query.length + 1);
    setInput(`${before}@${filepath} ${after}`);
    if (!attachments.includes(filepath)) setAttachments(prev => [...prev, filepath]);
    setMentionState(prev => ({ ...prev, active: false }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState.active && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionState(prev => ({ ...prev, index: (prev.index + 1) % filteredFiles.length })); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionState(prev => ({ ...prev, index: (prev.index - 1 + filteredFiles.length) % filteredFiles.length })); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(filteredFiles[mentionState.index]); }
      else if (e.key === 'Escape') setMentionState(prev => ({ ...prev, active: false }));
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAction(); }
  };

  const toggleAttachment = (filepath: string) => { setAttachments(prev => prev.includes(filepath) ? prev.filter(p => p !== filepath) : [...prev, filepath]); };

  return (
    <ChatInput input={input} setInput={setInput} onSend={handleSendAction} onStop={onStop} isGenerating={isGenerating} selectedChat={selectedChat} attachments={attachments} toggleAttachment={toggleAttachment} projectFiles={projectFiles} showFilePicker={showFilePicker} setShowFilePicker={setShowFilePicker} mentionState={mentionState} setMentionState={setMentionState} filteredFiles={filteredFiles} setFilteredFiles={setFilteredFiles} selectMention={selectMention} handleInputChange={handleInputChange} handleKeyDown={handleKeyDown} />
  );
}
