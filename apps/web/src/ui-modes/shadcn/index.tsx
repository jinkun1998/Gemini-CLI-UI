import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, Settings as SettingsIcon, Trash2, Check, Copy, X, File as FileIcon, RotateCcw, Folder, MessageSquare, Send, Sun, Moon, Square } from 'lucide-react';
import Mermaid from '../../components/Mermaid';
import CollapsibleCode from '../../components/CollapsibleCode';
import DiffViewer from '../../components/DiffViewer';
import GeminiLogo from '../../components/GeminiLogo';
import { ChatLayoutProps, MessageBubbleProps, ChatInputProps, UIModeComponents } from '../types';

export const ShadcnSidebar = React.memo(({ 
  projects, selectedProject, setSelectedProject,
  chats, selectedChat, setSelectedChat, handleCreateChat, handleDeleteChat, setShowSettings 
}: any) => (
  <div className="flex flex-col h-full bg-[var(--surface)] text-[var(--foreground)] p-3 gap-4 border-r border-[var(--border)] w-[260px]">
    <button 
      onClick={handleCreateChat}
      className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 hover:opacity-80 transition-opacity bg-[var(--card)] shadow-sm font-medium text-[var(--foreground)]"
    >
      <Plus className="w-4 h-4" /> New Thread
    </button>
    
    <div className="flex-1 overflow-y-auto space-y-6">
      <div>
        <div className="text-xs font-semibold text-[var(--foreground)]/50 mb-2 px-2 uppercase tracking-wider">Projects</div>
        <div className="space-y-1">
          {projects.map((p: string) => (
            <button 
              key={p}
              onClick={() => { setSelectedProject(p); setSelectedChat(null); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selectedProject === p ? 'bg-[var(--card)] font-medium text-[var(--foreground)] shadow-sm border border-[var(--border)]' : 'text-[var(--foreground)]/70 hover:bg-[var(--card)]/50'}`}
            >
              <Folder className="w-4 h-4" /> {p}
            </button>
          ))}
        </div>
      </div>
      
      {selectedProject && chats.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-[var(--foreground)]/50 mb-2 px-2 uppercase tracking-wider">Threads</div>
          <div className="space-y-1">
            {chats.map((c: any) => (
              <div key={c.id} className="group relative">
                <button 
                  onClick={() => setSelectedChat(c)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm truncate pr-8 transition-colors ${selectedChat?.id === c.id ? 'bg-[var(--card)] font-medium text-[var(--foreground)] shadow-sm border border-[var(--border)]' : 'text-[var(--foreground)]/70 hover:bg-[var(--card)]/50'}`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={(e) => handleDeleteChat(e, c.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete thread"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    
    <div className="mt-auto pt-2 border-t border-[var(--border)]">
      <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 text-sm text-[var(--foreground)]/70 hover:text-[var(--foreground)] p-2 rounded-lg hover:bg-[var(--card)]/50 w-full transition-colors">
        <SettingsIcon className="w-4 h-4" /> Settings
      </button>
    </div>
  </div>
));

export const ShadcnHeader = React.memo(({ model, setModel, fallbackStatus, toggleTheme, theme }: any) => (
  <header className="h-14 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-6">
    <div className="w-10" />
    <div className="flex-1 flex justify-center items-center gap-4">
      {fallbackStatus && (
        <span className="text-amber-500 animate-pulse font-medium flex items-center gap-1 text-sm">
          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
          {fallbackStatus}
        </span>
      )}
      <div className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-[var(--surface)] cursor-pointer text-[var(--foreground)] shadow-sm transition-colors">
        <select value={model} onChange={e => setModel(e.target.value)} className="bg-transparent border-none outline-none appearance-none cursor-pointer pr-4 font-medium text-[var(--foreground)]">
          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
          <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
          <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
        </select>
      </div>
    </div>
    <button 
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-[var(--surface)] transition-colors text-gray-400 hover:text-[var(--foreground)]"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  </header>
));

export const ShadcnSuggestions = React.memo(({ onSelect }: any) => {
  const suggestions = [
    { title: "Review my code", description: "Analyze the current file for bugs and improvements." },
    { title: "Explain architecture", description: "Give me an overview of the project structure." }
  ];
  return (
    <div className="flex flex-col items-center justify-center mt-20 mb-8 w-full max-w-2xl mx-auto px-4">
      <h2 className="text-2xl font-semibold mb-2 text-[var(--foreground)]">How can I help you today?</h2>
      <p className="text-[var(--foreground)]/60 mb-8">Select a prompt or type your own to get started.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {suggestions.map((s, i) => (
          <button 
            key={i} 
            onClick={() => onSelect(s.title + " - " + s.description)}
            className="text-left rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--surface)] cursor-pointer transition-colors shadow-sm bg-[var(--card)]"
          >
            <div className="font-medium text-[var(--foreground)] mb-1">{s.title}</div>
            <div className="text-sm text-[var(--foreground)]/60">{s.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
});

const ShadcnLayout: React.FC<ChatLayoutProps> = React.memo(({ sidebar, header, messages, input, children }) => (
  <div className="flex h-screen font-sans bg-[var(--background)] text-[var(--foreground)]">
    {sidebar}
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
      {header}
      <div className="flex-1 overflow-hidden relative flex flex-col items-center">
        <div className="w-full max-w-[90%] flex-1 flex flex-col overflow-hidden">
          {messages}
        </div>
        <div className="w-full max-w-[90%] pb-6 px-4">
          {input}
        </div>
      </div>
    </div>
    {children}
  </div>
));

const ShadcnMessage: React.FC<MessageBubbleProps> = React.memo(({ message, index, isStreaming, renderMermaid, onRetry }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex w-full mb-8 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 w-full max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm ${isUser ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-blue-600'}`}>
          {isUser ? 'U' : <GeminiLogo className="w-5 h-5" />}
        </div>
        <div className={`flex-1 overflow-hidden flex ${isUser ? 'flex-row-reverse' : 'flex-row'} min-w-0`}>
          <div className="flex-1 min-w-0">
            <div className={`inline-block text-left rounded-2xl px-5 py-3 overflow-x-auto shadow-sm ${isUser ? 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]' : 'text-[var(--foreground)]'} w-full`}>
            <div className={`prose max-w-none prose-p:leading-relaxed text-base ${isUser ? 'prose-p:my-0' : ''} dark:prose-invert`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');
                    if (!inline && language === 'mermaid' && renderMermaid) return <Mermaid chart={codeString} />;
                    if (!inline && language === 'diff') return <DiffViewer diffText={codeString} showActions={false} />;
                    return !inline && match ? (
                      <CollapsibleCode language={language} value={codeString} />
                    ) : (
                      <code {...props} className="bg-[var(--code-inline-bg)] text-[var(--code-inline-fg)] px-1 py-0.5 rounded text-sm font-mono">{children}</code>
                    )
                  }
                }}
              >
                {message.content + (isStreaming ? '...' : '')}
              </ReactMarkdown>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {isUser && onRetry && !isStreaming && (
              <button onClick={() => onRetry(index)} className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 transition-colors" title="Retry">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={handleCopy} className="text-xs text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80 flex items-center gap-1.5 transition-colors bg-[var(--surface)] px-2 py-1 rounded-md border border-[var(--border)] shadow-sm">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
});

const ShadcnInput: React.FC<ChatInputProps> = React.memo(({
  input, onSend, onStop, isGenerating, selectedChat, attachments, toggleAttachment,
  projectFiles, showFilePicker, setShowFilePicker, mentionState, filteredFiles,
  selectMention, handleInputChange, handleKeyDown
}) => (
  <div className="w-full bg-[var(--background)]">
    <div className="max-w-full mx-auto flex flex-col gap-2 relative">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 absolute bottom-full left-0 pb-2">
          {attachments.map(att => (
            <div key={att} className="flex items-center gap-1 bg-[var(--surface)] px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] shadow-sm">
              <FileIcon className="w-3.5 h-3.5 text-[var(--foreground)]/50" />
              <span className="truncate max-w-[200px] text-[var(--foreground)]/80">{att.split('/').pop() || att}</span>
              <button onClick={() => toggleAttachment(att)} className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 ml-1"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      
      <div className="relative flex items-end gap-2 p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] focus-within:border-[var(--foreground)]/30 transition-colors shadow-sm">
        <div className="relative shrink-0">
          <button 
            onClick={() => setShowFilePicker(!showFilePicker)}
            className="p-2 text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 bg-[var(--background)] hover:bg-[var(--surface)] rounded-full border border-[var(--border)] transition-colors flex items-center justify-center w-9 h-9"
          >
            <Plus className="w-4 h-4" />
          </button>
          {showFilePicker && (
            <div className="absolute bottom-full left-0 mb-3 w-64 max-h-64 overflow-y-auto bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl p-2 z-10 text-[var(--foreground)]">
              <div className="text-xs font-semibold text-[var(--foreground)]/50 mb-2 px-2">Attach Files</div>
              {projectFiles.length === 0 ? (
                <div className="text-xs text-[var(--foreground)]/40 px-2">No files found</div>
              ) : (
                projectFiles.map(f => (
                  <button 
                    key={f} 
                    onClick={() => { toggleAttachment(f); setShowFilePicker(false); }}
                    className="w-full text-left px-2 py-1.5 text-sm text-[var(--foreground)]/80 hover:bg-[var(--surface)] rounded-lg truncate flex items-center justify-between transition-colors"
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
          placeholder={selectedChat ? "Message Assistant..." : "Select or create a chat to begin..."}
          disabled={!selectedChat || isGenerating}
          className="flex-1 max-h-[200px] min-h-[24px] bg-transparent border-none focus:outline-none resize-none py-1.5 text-base placeholder-[var(--foreground)]/30 text-[var(--foreground)]"
          rows={Math.min(8, Math.max(1, input.split('\n').length))}
        />

        {mentionState.active && (
          <div className="absolute bottom-full mb-3 left-12 w-80 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50 text-[var(--foreground)]">
            <div className="p-2 border-b border-[var(--border)] text-xs font-semibold text-[var(--foreground)]/50 bg-[var(--surface)]">
              Mention File
            </div>
            <ul className="max-h-60 overflow-y-auto p-1">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((f, i) => (
                  <li key={f}>
                    <button
                      onClick={() => selectMention(f)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 truncate transition-colors ${
                        i === mentionState.index ? 'bg-[var(--surface)] text-[var(--foreground)] font-medium' : 'text-[var(--foreground)]/60 hover:bg-[var(--surface)]/50'
                      }`}
                    >
                      <FileIcon className="w-4 h-4 shrink-0 opacity-70" />
                      <span className="truncate">{f}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-4 text-center text-sm text-[var(--foreground)]/40">No matching files found</li>
              )}
            </ul>
          </div>
        )}

        <button 
          onClick={() => isGenerating ? onStop?.() : onSend()}
          disabled={(!input.trim() && !isGenerating) || !selectedChat}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            (input.trim() || isGenerating) && selectedChat
              ? 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 shadow-md' 
              : 'bg-[var(--surface)] text-[var(--foreground)]/30 cursor-not-allowed'
          }`}
        >
          {isGenerating ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4 ml-0.5" />}
        </button>
      </div>
      <div className="text-center text-xs text-[var(--foreground)]/40 mt-2">
        Assistant can make mistakes. Consider verifying important information.
      </div>
    </div>
  </div>
));

export const ShadcnMode: UIModeComponents = {
  ChatLayout: ShadcnLayout,
  MessageBubble: ShadcnMessage,
  ChatInput: ShadcnInput
};
