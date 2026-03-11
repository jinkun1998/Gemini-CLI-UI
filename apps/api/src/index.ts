import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
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
      if (!fs.existsSync(projectDir)) {
        fs.symlinkSync(externalPath, projectDir, 'dir');
      }
    } else if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Ensure chats/ folder exists (it won't exist in an external folder naturally)
    const chatsDir = path.join(projectDir, 'chats');
    if (!fs.existsSync(chatsDir)) {
      fs.mkdirSync(chatsDir, { recursive: true });
    }
    
    res.json({ name });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/projects/:project/chats', (req, res) => {
  const { project } = req.params;
  const chatsDir = path.join(PROJECTS_DIR, project, 'chats');
  if (!fs.existsSync(chatsDir)) {
    return res.json([]);
  }
  const files = fs.readdirSync(chatsDir).filter(f => f.endsWith('.json'));
  const chats = files.map(f => {
    const content = fs.readFileSync(path.join(chatsDir, f), 'utf-8');
    return JSON.parse(content);
  });
  chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(chats);
});

app.delete('/projects/:project/chats', (req, res) => {
  const { project } = req.params;
  const chatsDir = path.join(PROJECTS_DIR, project, 'chats');
  if (fs.existsSync(chatsDir)) {
    const files = fs.readdirSync(chatsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      fs.unlinkSync(path.join(chatsDir, file));
    }
  }
  res.json({ success: true });
});

app.post('/projects/:project/chats', (req, res) => {
  const { project } = req.params;
  const chatsDir = path.join(PROJECTS_DIR, project, 'chats');
  if (!fs.existsSync(chatsDir)) {
    fs.mkdirSync(chatsDir, { recursive: true });
  }
  const chat = {
    id: uuidv4(),
    title: 'New Chat',
    messages: [],
    geminiSessionId: null,
    model: req.body.model || 'gemini-3.1-pro',
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(chatsDir, `${chat.id}.json`), JSON.stringify(chat, null, 2));
  res.json(chat);
});

app.get('/projects/:project/files', (req, res) => {
  const { project } = req.params;
  const projectDir = path.join(PROJECTS_DIR, project);
  if (!fs.existsSync(projectDir)) {
    return res.json([]);
  }
  // Recursive read files
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
        } else if (stat.isFile()) {
          filelist.push(path.relative(projectDir, filepath));
        }
      } catch (err) {
        // ignore errors like broken symlinks
      }
    });
    return filelist;
  };
  const files = walkSync(projectDir);
  res.json(files);
});

app.get('/projects/:project/files/content', (req, res) => {
  const { project } = req.params;
  const filePath = req.query.path as string;
  const fullPath = path.join(PROJECTS_DIR, project, filePath);
  if (fs.existsSync(fullPath)) {
    res.send(fs.readFileSync(fullPath, 'utf-8'));
  } else {
    res.status(404).send('Not found');
  }
});

app.get('/browse', (req, res) => {
  const targetPath = (req.query.path as string) || process.cwd();
  try {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const result = entries.map(entry => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
      isDirectory: entry.isDirectory()
    }));
    // Sort directories first
    result.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
    res.json({ currentPath: targetPath, parentPath: path.dirname(targetPath), entries: result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Create Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'prompt') {
        const { project, chatId, prompt, model, geminiSessionId, approve, autoTitle } = data;
        
        const projectDir = path.join(PROJECTS_DIR, project);
        const chatsDir = path.join(projectDir, 'chats');
        const chatFile = path.join(chatsDir, `${chatId}.json`);
        
        let chat: Chat = { id: chatId, title: prompt.substring(0, 20), messages: [], geminiSessionId, model: model || 'gemini-3.1-pro', updatedAt: new Date().toISOString() };
        if (fs.existsSync(chatFile)) {
          chat = JSON.parse(fs.readFileSync(chatFile, 'utf-8'));
        }
        
        chat.messages.push({ role: 'user', content: prompt });
        chat.updatedAt = new Date().toISOString();
        if (chat.title === 'New Chat' && autoTitle !== false) {
          chat.title = prompt.substring(0, 30);
        }
        fs.writeFileSync(chatFile, JSON.stringify(chat, null, 2));

        const args = ['-p', prompt, '--output-format', 'stream-json'];
        if (model) {
          args.push('-m', model);
        }
        if (geminiSessionId) {
          args.push('-r', geminiSessionId);
        }
        if (approve === 'yolo') {
          args.push('--yolo');
        } else {
          args.push('--approval-mode', 'default');
        }
        
        const child = spawn('gemini', args, { cwd: projectDir, env: process.env });
        
        let assistantMessageContent = '';
        let currentSessionId = geminiSessionId;
        let pendingToolCall: any = null;

        let buffer = '';
        child.stdout.on('data', async (chunk) => {
          const chunkStr = chunk.toString();
          
          // Detect confirmation prompts (e.g., "[y/N]")
          if (chunkStr.includes('[y/N]') || chunkStr.includes('[Y/n]')) {
            let diffData = null;
            if (pendingToolCall && (pendingToolCall.name === 'replace' || pendingToolCall.name === 'write_file')) {
                const args = pendingToolCall.args;
                const filePath = path.join(PROJECTS_DIR, project, args.file_path);
                try {
                    const oldContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
                    let newContent = '';
                    if (pendingToolCall.name === 'replace') {
                        newContent = oldContent.replace(args.old_string, args.new_string);
                    } else {
                        newContent = args.content;
                    }
                    diffData = {
                        oldContent,
                        newContent,
                        filename: args.file_path
                    };
                } catch (e) {
                    console.error("Failed to prepare diff data", e);
                }
            }
            ws.send(JSON.stringify({ 
                type: 'confirm', 
                message: chunkStr.trim(),
                diff: diffData
            }));
          }

          buffer += chunkStr;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim() || !line.startsWith('{')) {
                continue;
            }
            try {
              const parsed = JSON.parse(line);
              ws.send(JSON.stringify(parsed));
              
              if (parsed.type === 'call') {
                  pendingToolCall = parsed;
              } else if (parsed.type === 'result') {
                  pendingToolCall = null;
              }

              if (parsed.type === 'init' && parsed.session_id) {
                currentSessionId = parsed.session_id;
                chat.geminiSessionId = currentSessionId;
              } else if (parsed.type === 'message' && parsed.role === 'assistant') {
                if (parsed.delta) {
                  assistantMessageContent += parsed.content;
                } else {
                  assistantMessageContent = parsed.content;
                }
              }
            } catch (e) {
              console.error("Error parsing stdout line:", line, e);
            }
          }
        });

        child.stderr.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          if (chunkStr.includes('[y/N]') || chunkStr.includes('[Y/n]')) {
            ws.send(JSON.stringify({ type: 'confirm', message: chunkStr.trim() }));
          }
          ws.send(JSON.stringify({ type: 'stderr', content: chunkStr }));
        });

        // Handle user interactive input for approvals (if we wanted to pipe it, but we can't easily with WS unless we have a pty or something, but we just implement YOLO vs Default and let it fail or approve)
        ws.on('message', (msg) => {
           const parsedMsg = JSON.parse(msg.toString());
           if (parsedMsg.type === 'input') {
               child.stdin.write(parsedMsg.content + '\n');
           }
        });

        child.on('close', (code) => {
           if (buffer.trim() && buffer.startsWith('{')) {
              try {
                const parsed = JSON.parse(buffer);
                ws.send(JSON.stringify(parsed));
                if (parsed.type === 'message' && parsed.role === 'assistant') {
                  if (parsed.delta) assistantMessageContent += parsed.content;
                  else assistantMessageContent = parsed.content;
                }
              } catch(e) {}
           }
           
           if (assistantMessageContent) {
              chat.messages.push({ role: 'assistant', content: assistantMessageContent });
              chat.updatedAt = new Date().toISOString();
              fs.writeFileSync(chatFile, JSON.stringify(chat, null, 2));
           }
           
           ws.send(JSON.stringify({ type: 'done', code }));
        });
      }
    } catch (e) {
      console.error(e);
      ws.send(JSON.stringify({ type: 'error', error: String(e) }));
    }
  });
});

const PORT = 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`API Server running on port ${PORT} (0.0.0.0)`);
});
