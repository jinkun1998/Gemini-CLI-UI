import { GeminiMode } from './gemini';
import { ChatGPTMode } from './chatgpt';
import { ShadcnMode } from './shadcn';
import { UIMode, UIModeComponents } from './types';

export const UI_MODES: Record<UIMode, UIModeComponents> = {
  gemini: GeminiMode,
  chatgpt: ChatGPTMode,
  shadcn: ShadcnMode
};

export * from './types';
