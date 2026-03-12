import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, Send, Check, X, File as FileIcon, RotateCcw, Copy, Square } from 'lucide-react';
import Mermaid from '../../components/Mermaid';
import CollapsibleCode from '../../components/CollapsibleCode';
import DiffViewer from '../../components/DiffViewer';
import { ChatLayoutProps, MessageBubbleProps, ChatInputProps, UIModeComponents } from '../types';

const ChatLayout: React.FC<ChatLayoutProps> = React.memo(({ sidebar, header, messages, input, children }) => (
  <div className={`flex h-screen font-sans theme-gemini bg-[var(--background)] text-[var(--foreground)]`}>
    <div className="w-64 border-r flex flex-col bg-[var(--surface)] border-[var(--border)]">
      {sidebar}
    </div>
    <div className="flex-1 flex flex-col min-w-0">
      {header}
      {messages}
      {input}
    </div>
    {children}
  </div>
));

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, index, isStreaming, renderMermaid, onRetry }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex w-full mb-6 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 w-full max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm ${isUser ? 'bg-blue-600' : 'bg-purple-600'}`}>
          {isUser ? 'U' : 'G'}
        </div>

        <div className={`flex-1 flex ${isUser ? 'flex-row-reverse' : 'flex-row'} min-w-0`}>
          <div className={`inline-block text-left rounded-[var(--radius)] px-5 py-3 overflow-x-auto shadow-sm ${
            isUser 
              ? 'bg-[var(--bubble-user-bg)] text-[var(--bubble-user-fg)]' 
              : 'bg-[var(--bubble-assistant-bg)] text-[var(--bubble-assistant-fg)] border border-[var(--bubble-assistant-border)]'
          }`}>

            <div className={`prose max-w-none dark:prose-invert ${isUser ? 'prose-p:my-0' : ''} prose-p:leading-relaxed`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');

                    if (!inline && language === 'mermaid' && renderMermaid) {
                      return <Mermaid chart={codeString} />;
                    }

                    if (!inline && language === 'diff') {
                      return <DiffViewer diffText={codeString} showActions={false} />;
                    }

                    return !inline && match ? (
                      <CollapsibleCode language={language} value={codeString} />
                    ) : (
                      <code {...props} className="bg-[var(--code-inline-bg)] text-[var(--code-inline-fg)] px-1 py-0.5 rounded text-sm font-mono">
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
          
          <div className="flex flex-col gap-1 px-2 shrink-0 self-end mb-1">
            {isUser && onRetry && !isStreaming && (
              <button onClick={() => onRetry(index)} className="text-gray-500 hover:text-[var(--foreground)] transition-colors" title="Retry"><RotateCcw className="w-3.5 h-3.5" /></button>
            )}
            <button onClick={handleCopy} className="text-gray-500 hover:text-[var(--foreground)] transition-colors" title="Copy">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const ChatInput: React.FC<ChatInputProps> = ({
  input, onSend, onStop, isGenerating, selectedChat, attachments, toggleAttachment,
  projectFiles, showFilePicker, setShowFilePicker, mentionState, filteredFiles,
  selectMention, handleInputChange, handleKeyDown
}) => (
  <div className="p-4 border-t bg-[var(--surface)] border-[var(--border)]">
    <div className="max-w-4xl mx-auto flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map(att => (
            <div key={att} className="flex items-center gap-1 bg-blue-500/10 dark:bg-blue-900/50 text-blue-600 dark:text-blue-200 px-2 py-1 rounded-[var(--radius)] text-xs border border-blue-200 dark:border-blue-700 shadow-sm">
              <FileIcon className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{att}</span>
              <button onClick={() => toggleAttachment(att)} className="hover:text-[var(--foreground)] ml-1"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
      
      <div className="relative flex items-end gap-2 p-2 rounded-[var(--radius)] border border-[var(--border)] focus-within:border-[var(--foreground)]/30 transition-colors shadow-sm bg-[var(--background)]">
        <div className="relative shrink-0">
          <button 
            onClick={() => setShowFilePicker(!showFilePicker)}
            className="p-2 text-gray-400 hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-[var(--radius)] transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          {showFilePicker && (
            <div className="absolute bottom-full left-0 mb-2 w-64 max-h-64 overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-xl p-2 z-10 text-[var(--foreground)]">
              <div className="text-xs font-semibold text-gray-400 mb-2 px-2">Attach Files</div>
              {projectFiles.length === 0 ? (
                <div className="text-xs text-gray-500 px-2">No files found</div>
              ) : (
                projectFiles.map(f => (
                  <button 
                    key={f} 
                    onClick={() => { toggleAttachment(f); setShowFilePicker(false); }}
                    className="w-full text-left px-2 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--background)] rounded-[var(--radius)] truncate flex items-center justify-between transition-colors"
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
          className="flex-1 max-h-64 min-h-[44px] bg-transparent border-none focus:outline-none resize-none py-3 text-sm scrollbar-thin placeholder-gray-500 relative text-[var(--foreground)]"
          rows={Math.min(10, input.split('\n').length)}
        />

        {mentionState.active && (
          <div className="absolute bottom-full mb-2 left-10 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-xl overflow-hidden z-50 text-[var(--foreground)]">
            <div className="p-2 border-b border-[var(--border)] text-xs font-semibold text-gray-400 bg-[var(--background)]/50">
              Mention File
            </div>
            <ul className="max-h-60 overflow-y-auto p-1">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((f, i) => (
                  <li key={f}>
                    <button
                      onClick={() => selectMention(f)}
                      className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 truncate transition-colors ${
                        i === mentionState.index ? 'bg-blue-600 text-white' : 'hover:bg-[var(--background)]'
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
          onClick={() => isGenerating ? onStop?.() : onSend()}
          disabled={(!input.trim() && !isGenerating) || !selectedChat}
          className={`p-2 rounded-[var(--radius)] transition-colors flex items-center justify-center ${
            (input.trim() || isGenerating) && selectedChat
              ? 'bg-blue-600 text-white hover:bg-blue-500' 
              : 'bg-[var(--surface)] text-gray-500 cursor-not-allowed'
          }`}
        >
          {isGenerating ? <Square className="w-5 h-5 fill-current" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      <div className="text-center text-xs text-gray-500 mt-1">
        Gemini CLI Web Interface. Model outputs may be inaccurate.
      </div>
    </div>
  </div>
);

export const GeminiMode: UIModeComponents = {
  ChatLayout,
  MessageBubble,
  ChatInput
};
