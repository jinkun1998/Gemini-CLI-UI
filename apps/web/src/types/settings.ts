export type UIMode = 'gemini' | 'chatgpt' | 'shadcn';
export type AgentPolicy = 'ask' | 'safe' | 'yolo' | 'custom';
export type Theme = 'light' | 'dark' | 'system';

export type Settings = {
  agentPolicy: AgentPolicy;
  toolPermissions: {
    read_file: boolean;
    write_file: boolean;
    run_shell_command: boolean;
    grep_search: boolean;
    list_directory: boolean;
    replace: boolean;
    generalist: boolean;
    codebase_investigator: boolean;
    cli_help: boolean;
  };
  chat: {
    autoScroll: boolean;
    renderMermaid: boolean;
    showLogs: boolean;
    autoTitle: boolean;
    playSound: boolean;
  };
  appearance: {
    uiMode: UIMode;
    theme: Theme;
  };
};

export const defaultSettings: Settings = {
  agentPolicy: 'ask',
  toolPermissions: {
    read_file: true,
    write_file: false,
    run_shell_command: false,
    grep_search: true,
    list_directory: true,
    replace: false,
    generalist: true,
    codebase_investigator: true,
    cli_help: true,
  },
  chat: {
    autoScroll: true,
    renderMermaid: true,
    showLogs: false,
    autoTitle: true,
    playSound: true,
  },
  appearance: {
    uiMode: 'gemini',
    theme: 'system',
  }
};
