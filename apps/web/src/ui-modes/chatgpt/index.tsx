import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, Send, Check, X, File as FileIcon, RotateCcw, Copy, Square } from 'lucide-react';
import Mermaid from '../../components/Mermaid';
import CollapsibleCode from '../../components/CollapsibleCode';
import DiffViewer from '../../components/DiffViewer';
import GeminiLogo from '../../components/GeminiLogo';
import { ChatLayoutProps, MessageBubbleProps, ChatInputProps, UIModeComponents } from '../types';

const ChatLayout: React.FC<ChatLayoutProps> = React.memo(({ sidebar, header, messages, input, children }) => (
  <div className={`flex h-screen font-sans theme-chatgpt bg-[var(--background)] text-[var(--foreground)]`}>
    <div className="w-64 flex flex-col bg-[var(--background)] text-[var(--foreground)] border-r border-[var(--border)]">
      {sidebar}
    </div>
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
      {header}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {messages}
        <div className="max-w-[90%] mx-auto w-full px-4">
          {input}
        </div>
      </div>
    </div>
    {children}
  </div>
));

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, index, isStreaming, renderMermaid, onRetry, onConfirmRequest }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`py-8 w-full flex ${isUser ? 'justify-end' : 'justify-start bg-[var(--surface)]'}`}>
      <div className={`flex gap-2 px-4 w-full max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} mx-auto`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs ${isUser ? 'bg-[#5436da]' : 'bg-[#10a37f]'}`}>
          {isUser ? 'U' : <GeminiLogo className="w-5 h-5" />}
        </div>
        <div className={`flex-1 overflow-hidden text-[var(--foreground)] flex ${isUser ? 'flex-row-reverse' : 'flex-row'} min-w-0`}>
          <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
            <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className="font-bold text-sm">
                {isUser ? 'You' : 'Assistant'}
              </div>
              <div className="flex items-center gap-1">
                {isUser && !isStreaming && onRetry && (
                  <button onClick={() => onRetry(index)} className="text-gray-500 hover:text-gray-300 transition-colors" title="Retry"><RotateCcw className="w-3.5 h-3.5" /></button>
                )}
                {!isStreaming && (
                  <button onClick={handleCopy} className="text-gray-500 hover:text-gray-300 transition-colors" title="Copy">{copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
                )}
              </div>
            </div>
            <div className={`prose max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-[var(--surface)] prose-pre:border prose-pre:border-[var(--border)] text-[var(--foreground)]`}>
              <div className={isUser ? 'inline-block text-left bg-[var(--surface)] px-4 py-2 rounded-2xl shadow-sm border border-[var(--border)]' : ''}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  
                components={{
                  p({ children }) {
                    const content = React.Children.toArray(children);
                    const firstChild = content[0];
                    if (typeof firstChild === 'string' && firstChild.includes('[[CONFIRM:')) {
                      const match = firstChild.match(/\[\[CONFIRM: (.*?)\]\]/);
                      if (match) {
                        const action = match[1];
                        return (
                          <div className="my-4 p-4 border border-[#10a37f]/30 bg-[#10a37f]/10 rounded-xl flex flex-col items-center gap-3 text-center">
                            <p className="text-sm font-medium text-[#10a37f] m-0">Action Required: {action}</p>
                            <button 
                              onClick={() => onConfirmRequest?.(action)}
                              className="px-6 py-2 bg-[#10a37f] hover:bg-[#1a7f64] text-white rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95"
                            >
                              Approve Action
                            </button>
                          </div>
                        );
                      }
                    }
                    return <p>{children}</p>;
                  },

            
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
  <div className="pb-6 pt-2">
    <div className="relative flex flex-col w-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm focus-within:border-[var(--foreground)]/30 transition-all">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          {attachments.map(att => (
            <div key={att} className="flex items-center gap-1 bg-[#2f2f2f] text-gray-200 px-2 py-1 rounded-lg text-xs border border-gray-700">
              <FileIcon className="w-3 h-3" />
              <span className="truncate max-w-[150px]">{att}</span>
              <button onClick={() => toggleAttachment(att)} className="hover:text-white"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-2 px-3">
        <div className="relative">
          <button 
            onClick={() => setShowFilePicker(!showFilePicker)}
            className="p-2 text-gray-400 hover:text-[var(--foreground)] hover:bg-[var(--background)] rounded-xl transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          {showFilePicker && (
            <div className="absolute bottom-full left-0 mb-2 w-64 max-h-64 overflow-y-auto bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl p-2 z-10 text-[var(--foreground)]">
              {projectFiles.map(f => (
                <button 
                  key={f} 
                  onClick={() => { toggleAttachment(f); setShowFilePicker(false); }}
                  className="w-full text-left px-2 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface)] rounded-lg truncate flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{f}</span>
                  {attachments.includes(f) && <Check className="w-4 h-4 text-[#10a37f]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message Gemini CLI..."
          disabled={!selectedChat || isGenerating}
          className="flex-1 max-h-64 min-h-[44px] bg-transparent border-none focus:outline-none resize-none py-3 text-base placeholder-[var(--foreground)]/30 text-[var(--foreground)]"
          rows={1}
        />

        {mentionState.active && (
          <div className="absolute bottom-full mb-2 left-4 w-80 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50 text-[var(--foreground)]">
            <ul className="max-h-60 overflow-y-auto p-1">
              {filteredFiles.map((f, i) => (
                <li key={f}>
                  <button
                    onClick={() => selectMention(f)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 truncate transition-colors ${
                      i === mentionState.index ? 'bg-[var(--surface)] text-[var(--foreground)] font-medium' : 'hover:bg-[var(--surface)]'
                    }`}
                  >
                    <FileIcon className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="truncate">{f}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button 
          onClick={() => isGenerating ? onStop?.() : onSend()}
          disabled={(!input.trim() && !isGenerating) || !selectedChat}
          className={`p-2 rounded-xl transition-all flex items-center justify-center ${
            (input.trim() || isGenerating) && selectedChat
              ? 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 shadow-md' 
              : 'bg-[var(--surface)] text-gray-500 cursor-not-allowed'
          }`}
        >
          {isGenerating ? <Square className="w-5 h-5 fill-current" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
    <div className="text-center text-[10px] text-gray-500 mt-2">
      Gemini CLI can make mistakes. Check important info.
    </div>
  </div>
);

export const ChatGPTMode: UIModeComponents = {
  ChatLayout,
  MessageBubble,
  ChatInput
};
