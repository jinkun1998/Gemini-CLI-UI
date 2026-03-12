import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

type Message = { role: string; content: string };
type Chat = { id: string; title: string; messages: Message[]; geminiSessionId: string | null; model: string; updatedAt: string };

const app = express();
app.use(cors());
app.use(express.json());

const WORKSPACE_DIR = path.resolve(__dirname, '../../workspace');
const PROJECTS_DIR = path.join(WORKSPACE_DIR, 'projects');

if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// Helper to generate understandable titles
async function generateUnderstandableTitle(prompt: string, projectDir: string, model: string): Promise<string> {
  return new Promise((resolve) => {
    const titlePrompt = `Generate a very short (max 5 words), concise, understandable title for a chat that starts with this message: "${prompt.substring(0, 500)}". Respond ONLY with the title text, no quotes or punctuation.`;
    const args = ['-p', titlePrompt, '--output-format', 'text', '-m', 'gemini-2.5-flash']; // Use faster model for titles
    const child = spawn('gemini', args, { cwd: projectDir, env: process.env });
    let title = '';
    child.stdout.on('data', (data) => { title += data.toString(); });
    child.on('close', () => {
      let finalTitle = title.trim().replace(/^["']|["']$/g, '');
      if (!finalTitle || finalTitle.length > 100) {
          finalTitle = prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '');
      }
      resolve(finalTitle);
    });
  });
}

// API Routes
app.get('/projects', (req, res) => {
  try {
    const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter(dirent => {
        if (dirent.isDirectory()) return true;
        if (dirent.isSymbolicLink()) {
          try {
            return fs.statSync(path.join(PROJECTS_DIR, dirent.name)).isDirectory();
          } catch (e) {
            return false;
          }
        }
        return false;
      })
      .map(dirent => dirent.name);
    res.json(dirs);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/projects', (req, res) => {
  const { name, path: externalPath } = req.body;
  const projectDir = path.join(PROJECTS_DIR, name);
  try {
    if (externalPath) {
      if (!fs.existsSync(projectDir)) fs.symlinkSync(externalPath, projectDir, 'dir');
    } else if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    const chatsDir = path.join(projectDir, 'chats');
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true });
    res.json({ name });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/projects/:project/chats', (req, res) => {
  const { project } = req.params;
  const chatsDir = path.join(PROJECTS_DIR, project, 'chats');
  if (!fs.existsSync(chatsDir)) return res.json([]);
  const files = fs.readdirSync(chatsDir).filter(f => f.endsWith('.json'));
  const chats = files.map(f => {
    const content = fs.readFileSync(path.join(chatsDir, f), 'utf-8');
    return JSON.parse(content);
  });
  chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(chats);
});

app.delete('/projects/:project/chats/:id', (req, res) => {
  const { project, id } = req.params;
  const chatFile = path.join(PROJECTS_DIR, project, 'chats', `${id}.json`);
  if (fs.existsSync(chatFile)) { fs.unlinkSync(chatFile); res.json({ success: true }); }
  else res.status(404).json({ error: 'Chat not found' });
});

app.post('/projects/:project/chats', (req, res) => {
  const { project } = req.params;
  const chatsDir = path.join(PROJECTS_DIR, project, 'chats');
  if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true });
  const chat = { id: uuidv4(), title: 'New Chat', messages: [], geminiSessionId: null, model: req.body.model || 'gemini-3.1-pro', updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(chatsDir, `${chat.id}.json`), JSON.stringify(chat, null, 2));
  res.json(chat);
});

app.get('/projects/:project/files', (req, res) => {
  const { project } = req.params;
  const projectDir = path.join(PROJECTS_DIR, project);
  if (!fs.existsSync(projectDir)) return res.json([]);
  const walkSync = (dir: string, filelist: string[] = []) => {
    if(!fs.existsSync(dir)) return filelist;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filepath = path.join(dir, file);
      try {
        const stat = fs.lstatSync(filepath);
        if (stat.isDirectory()) {
          if(file === 'chats' || file === '.gemini' || file === 'node_modules' || file === '.git' || file === 'files' || file === 'workspace' || file === '.next') return;
          filelist = walkSync(filepath, filelist);
        } else if (stat.isFile()) filelist.push(path.relative(projectDir, filepath));
      } catch (err) {}
    });
    return filelist;
  };
  res.json(walkSync(projectDir));
});

app.get('/projects/:project/files/content', (req, res) => {
  const { project } = req.params;
  const filePath = req.query.path as string;
  const fullPath = path.join(PROJECTS_DIR, project, filePath);
  if (fs.existsSync(fullPath)) res.send(fs.readFileSync(fullPath, 'utf-8'));
  else res.status(404).send('Not found');
});

app.get('/browse', (req, res) => {
  const targetPath = (req.query.path as string) || process.cwd();
  try {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const result = entries.map(entry => ({ name: entry.name, path: path.join(targetPath, entry.name), isDirectory: entry.isDirectory() }));
    result.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
    res.json({ currentPath: targetPath, parentPath: path.dirname(targetPath), entries: result });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let activeChild: ChildProcess | null = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'input' && activeChild && activeChild.stdin) {
        activeChild.stdin.write(data.content + '\n');
        return;
      }

      if (data.type === 'stop' && activeChild) {
        activeChild.kill('SIGINT');
        return;
      }

      if (data.type === 'prompt') {
        const { project, chatId, prompt, model, geminiSessionId, approve, autoTitle, isRetry, toolPermissions } = data;
        const projectDir = path.join(PROJECTS_DIR, project);

        const chatsDir = path.join(projectDir, 'chats');
        const chatFile = path.join(chatsDir, `${chatId}.json`);
        
        let chat: Chat = { id: chatId, title: prompt.substring(0, 20), messages: [], geminiSessionId, model: model || 'gemini-3.1-pro', updatedAt: new Date().toISOString() };
        if (fs.existsSync(chatFile)) chat = JSON.parse(fs.readFileSync(chatFile, 'utf-8'));
        
        const isFirstMessage = chat.messages.length === 0;
        if (!isRetry) {
          chat.messages.push({ role: 'user', content: prompt });
          chat.updatedAt = new Date().toISOString();
          if (isFirstMessage && autoTitle !== false) chat.title = prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '');
          fs.writeFileSync(chatFile, JSON.stringify(chat, null, 2));
        }

        const args = ['-p', prompt, '--output-format', 'stream-json', '-e', 'all'];
        if (model) args.push('-m', model);
        if (geminiSessionId) args.push('-r', geminiSessionId);
        
        const customEnv: Record<string, string> = { ...process.env, PYTHONUNBUFFERED: '1' };
        
        // Handle approvals
        if (approve === 'yolo') {
          args.push('--approval-mode', 'yolo');
          // Explicitly allow all common tools in YOLO mode via env vars too
          ['read_file', 'write_file', 'run_shell_command', 'grep_search', 'list_directory', 'replace', 'generalist', 'codebase_investigator', 'cli_help'].forEach(t => {
            customEnv[`GEMINI_AUTO_APPROVE_${t.toUpperCase()}`] = 'true';
          });
        } else if (approve === 'safe') {
          args.push('--approval-mode', 'auto_edit');
          // Safe mode: Auto-approve edits
          ['read_file', 'write_file', 'grep_search', 'list_directory', 'replace'].forEach(t => {
            customEnv[`GEMINI_AUTO_APPROVE_${t.toUpperCase()}`] = 'true';
          });
        } else if (approve === 'custom' && toolPermissions) {
          args.push('--approval-mode', 'default');
          for (const [tool, approved] of Object.entries(toolPermissions)) {
            customEnv[`GEMINI_AUTO_APPROVE_${tool.toUpperCase()}`] = approved ? 'true' : 'false';
          }
        } else {
          args.push('--approval-mode', 'default');
        }
        
        const child = spawn('gemini', args, { cwd: projectDir, env: customEnv });
        activeChild = child;
        
        let assistantMessageContent = '';
        let currentSessionId = geminiSessionId;
        let pendingToolCall: any = null;
        let textBufferForConfirm = '';
        let buffer = '';

        const handleConfirmation = (text: string, project: string, toolCall: any, ws: WebSocket) => {
          let diffData = null;
          let cleanedMessage = text.trim();
          if (toolCall && (toolCall.name === 'replace' || toolCall.name === 'write_file')) {
              const args = toolCall.args;
              const filePath = path.join(PROJECTS_DIR, project, args.file_path);
              try {
                  const oldContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
                  let newContent = '';
                  if (toolCall.name === 'replace') {
                      if (oldContent.includes(args.old_string)) newContent = oldContent.replace(args.old_string, args.new_string);
                      else newContent = args.new_string; 
                  } else newContent = args.content;
                  diffData = { oldContent, newContent, filename: args.file_path };
                  const lines = cleanedMessage.split('\n');
                  const filteredLines = [];
                  let inDiff = false;
                  for (const l of lines) {
                      if (l.startsWith('--- ') || l.startsWith('+++ ') || l.startsWith('@@ ')) { inDiff = true; continue; }
                      if (inDiff) { if (l.startsWith('-') || l.startsWith('+') || l.startsWith(' ')) continue; else inDiff = false; }
                      filteredLines.push(l);
                  }
                  cleanedMessage = filteredLines.join('\n').trim();
                  if (cleanedMessage.includes('[y/N]') && cleanedMessage.length < 50) cleanedMessage = `Do you want to apply these changes to ${args.file_path}?`;
              } catch (e) { console.error("Failed to prepare diff data", e); }
          }
          ws.send(JSON.stringify({ type: 'confirm', message: cleanedMessage, diff: diffData }));
        };

        child.stdout.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith('{')) {
              try {
                const parsed = JSON.parse(line);
                ws.send(JSON.stringify(parsed));
                if (parsed.type === 'call' || parsed.type === 'tool_use') pendingToolCall = parsed;
                else if (parsed.type === 'result' || parsed.type === 'tool_result') pendingToolCall = null;
                if (parsed.type === 'init' && parsed.session_id) { currentSessionId = parsed.session_id; chat.geminiSessionId = currentSessionId; }
                else if (parsed.type === 'message' && parsed.role === 'assistant') {
                  if (parsed.delta) assistantMessageContent += parsed.content;
                  else assistantMessageContent = parsed.content;
                }
              } catch (e) { console.error("Error parsing JSON line:", line, e); }
            } else {
              if (line.includes('[y/N]') || line.includes('[Y/n]')) {
                handleConfirmation(textBufferForConfirm + '\n' + line, project, pendingToolCall, ws);
                textBufferForConfirm = '';
              } else {
                textBufferForConfirm += line + '\n';
                ws.send(JSON.stringify({ type: 'stdout', content: line }));
              }
            }
          }
          if (buffer.includes('[y/N]') || buffer.includes('[Y/n]')) {
            handleConfirmation(textBufferForConfirm + '\n' + buffer, project, pendingToolCall, ws);
            textBufferForConfirm = '';
            buffer = '';
          }
        });

        child.stderr.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          if (chunkStr.includes('[y/N]') || chunkStr.includes('[Y/n]')) {
            handleConfirmation(textBufferForConfirm + '\n' + chunkStr, project, pendingToolCall, ws);
            textBufferForConfirm = '';
          } else {
            textBufferForConfirm += chunkStr;
            ws.send(JSON.stringify({ type: 'stdout', content: chunkStr }));
          }
          ws.send(JSON.stringify({ type: 'stderr', content: chunkStr }));
        });

        child.on('close', async (code) => {
           activeChild = null;
           if (assistantMessageContent) {
              chat.messages.push({ role: 'assistant', content: assistantMessageContent });
              chat.updatedAt = new Date().toISOString();
              if (isFirstMessage && autoTitle !== false) {
                  const betterTitle = await generateUnderstandableTitle(prompt, projectDir, model);
                  chat.title = betterTitle;
                  ws.send(JSON.stringify({ type: 'title_update', title: betterTitle, chatId: chat.id }));
              }
              fs.writeFileSync(chatFile, JSON.stringify(chat, null, 2));
           }
           ws.send(JSON.stringify({ type: 'done', code }));
        });
      }
    } catch (e) { console.error(e); ws.send(JSON.stringify({ type: 'error', error: String(e) })); }
  });
});

const PORT = 4000;
server.listen(PORT, '0.0.0.0', () => { console.log(`API Server running on port ${PORT} (0.0.0.0)`); });
