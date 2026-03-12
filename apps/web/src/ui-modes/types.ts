import React from 'react';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type UIMode = 'gemini' | 'chatgpt' | 'shadcn';

export interface ChatLayoutProps {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  messages: React.ReactNode;
  input: React.ReactNode;
  children?: React.ReactNode;
}

export interface MessageBubbleProps {
  message: Message;
  index: number;
  isStreaming?: boolean;
  renderMermaid: boolean;
  onRetry?: (index: number) => void;
}

export interface ChatInputProps {
  input: string;
  setInput: (v: string) => void;
  onSend: (text?: string) => void;
  onStop?: () => void;
  isGenerating: boolean;
  selectedChat: any;
  attachments: string[];
  toggleAttachment: (path: string) => void;
  projectFiles: string[];
  showFilePicker: boolean;
  setShowFilePicker: (v: boolean) => void;
  mentionState: { active: boolean; query: string; startIndex: number; index: number };
  setMentionState: React.Dispatch<React.SetStateAction<{ active: boolean; query: string; startIndex: number; index: number }>>;
  filteredFiles: string[];
  setFilteredFiles: React.Dispatch<React.SetStateAction<string[]>>;
  selectMention: (path: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export interface UIModeComponents {
  ChatLayout: React.ComponentType<ChatLayoutProps>;
  MessageBubble: React.ComponentType<MessageBubbleProps>;
  ChatInput: React.ComponentType<ChatInputProps>;
}
