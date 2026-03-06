import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import sessionManager from './sessionManager.js';
import GeminiResponseHandler from './gemini-response-handler.js';
import { DEFAULT_MODELS, getModelOrder } from './models.js';

let activeGeminiProcesses = new Map(); // Track active processes by session ID

async function spawnGemini(command, options = {}, ws) {
  const modelOrder = getModelOrder();
  // Ensure currentModel is clean (no models/ prefix) for matching in modelOrder
  const rawModel = options.model || modelOrder[0];
  const currentModel = rawModel.replace('models/', '');
  
  return new Promise(async (resolve, reject) => {
    const { sessionId, projectPath, cwd, resume, toolsSettings, permissionMode, images } = options;
    let capturedSessionId = sessionId; // Track session ID throughout the process
    let sessionCreatedSent = false; // Track if we've already sent session-created event
    let fullResponse = ''; // Accumulate the full response
    let quotaReached = false;
    
    // Process images if provided
    
    // Use tools settings passed from frontend, or defaults
    const settings = toolsSettings || {
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false
    };
    
    // Build Gemini CLI command - start with print/resume flags first
    const args = [];
    
    // Add prompt flag with command if we have a command
    if (command && command.trim()) {
      // If we have a sessionId, include conversation history
      if (sessionId) {
        const context = sessionManager.buildConversationContext(sessionId);
        if (context) {
          // Combine context with current command
          const fullPrompt = context + command;
          args.push('--prompt', fullPrompt);
        } else {
          args.push('--prompt', command);
        }
      } else {
        args.push('--prompt', command);
      }
    }
    
    // Use cwd (actual project directory) instead of projectPath (Gemini's metadata directory)
    const cleanPath = (cwd || process.cwd()).replace(/[^\x20-\x7E]/g, '').trim();
    const workingDir = cleanPath;
    
    // Handle images by saving them to temporary files and passing paths to Gemini
    const tempImagePaths = [];
    let tempDir = null;
    if (images && images.length > 0) {
      try {
        tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
        await fs.mkdir(tempDir, { recursive: true });
        
        for (const [index, image] of images.entries()) {
          const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) continue;
          
          const [, mimeType, base64Data] = matches;
          const extension = mimeType.split('/')[1] || 'png';
          const filename = `image_${index}.${extension}`;
          const filepath = path.join(tempDir, filename);
          
          await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
          tempImagePaths.push(filepath);
        }
        
        if (tempImagePaths.length > 0 && command && command.trim()) {
          const imageNote = `\n\n[画像を添付しました: ${tempImagePaths.length}枚の画像があります。以下のパスに保存されています:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
          
          const promptIndex = args.indexOf('--prompt');
          if (promptIndex !== -1) {
            args[promptIndex + 1] = args[promptIndex + 1] + imageNote;
          }
        }
      } catch (error) {
        // Error processing images
      }
    }
    
    // Add basic flags
    if (options.debug) args.push('--debug');
    
    // Add model
    args.push('--model', currentModel);
    
    // Add approval-mode if specified
    if (permissionMode) {
      args.push('--approval-mode', permissionMode);
    }
    
    // Add --yolo flag if skipPermissions is enabled
    if (settings.skipPermissions) {
      args.push('--yolo');
    }

    // Add allowed tools
    const allowedTools = settings.allowedTools && settings.allowedTools.length > 0 
      ? settings.allowedTools 
      : [
          'Read', 'Edit', 'Write', 'Grep', 'Glob', 'Bash',
          'read_file', 'write_file', 'replace', 'grep_search', 'glob', 'run_shell_command', 'web_fetch', 'google_web_search'
        ]; // Default allowed tools for better UX
    
    if (allowedTools.length > 0) {
      args.push('--allowed-tools', allowedTools.join(','));
    }
    
    const geminiPath = process.env.GEMINI_PATH || 'gemini';
    const geminiProcess = spawn(geminiPath, args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    
    geminiProcess.tempImagePaths = tempImagePaths;
    geminiProcess.tempDir = tempDir;
    
    const processKey = capturedSessionId || sessionId || Date.now().toString();
    activeGeminiProcesses.set(processKey, geminiProcess);
    geminiProcess.sessionId = processKey;
    geminiProcess.stdin.end();
    
    let hasReceivedOutput = false;
    const timeoutMs = 30000;
    const timeout = setTimeout(() => {
      if (!hasReceivedOutput && !quotaReached) {
        const currentId = capturedSessionId || sessionId || processKey;
        ws.send(JSON.stringify({
          type: 'gemini-error',
          sessionId: currentId,
          error: 'Gemini CLI timeout - no response received'
        }));
        geminiProcess.kill('SIGTERM');
      }
    }, timeoutMs);
    
    if (command && capturedSessionId) {
      sessionManager.addMessage(capturedSessionId, 'user', command);
    }
    
    let responseHandler;
    if (ws) {
      responseHandler = new GeminiResponseHandler(ws, {
        partialDelay: 300,
        maxWaitTime: 1500,
        minBufferSize: 30
      });
    }
    
    let outputBuffer = '';
    
    geminiProcess.stdout.on('data', (data) => {
      const rawOutput = data.toString();
      outputBuffer += rawOutput;
      hasReceivedOutput = true;
      clearTimeout(timeout);
      
      const lines = rawOutput.split('\n');
      const filteredLines = lines.filter(line => {
        if (line.includes('[DEBUG]') || 
            line.includes('Flushing log events') || 
            line.includes('Clearcut response') ||
            line.includes('[MemoryDiscovery]') ||
            line.includes('[BfsFileSearch]') ||
            line.includes('Loaded cached credentials')) {
          return false;
        }
        return true;
      });
      
      const filteredOutput = filteredLines.join('\n').trim();
      
      if (!sessionId && !sessionCreatedSent && !capturedSessionId) {
        capturedSessionId = `gemini_${Date.now()}`;
        sessionCreatedSent = true;
        sessionManager.createSession(capturedSessionId, cwd || process.cwd());
        if (command) sessionManager.addMessage(capturedSessionId, 'user', command);
        if (processKey !== capturedSessionId) {
          activeGeminiProcesses.delete(processKey);
          activeGeminiProcesses.set(capturedSessionId, geminiProcess);
        }
        ws.send(JSON.stringify({ type: 'session-created', sessionId: capturedSessionId }));
      }

      if (filteredOutput) {
        fullResponse += (fullResponse ? '\n' : '') + filteredOutput;
        const currentId = capturedSessionId || sessionId || processKey;
        if (responseHandler) {
          responseHandler.processData(filteredOutput, currentId);
        } else {
          ws.send(JSON.stringify({
            type: 'gemini-response',
            sessionId: currentId,
            data: { type: 'message', content: filteredOutput }
          }));
        }
      }
    });
    
    let hasReceivedStderr = false;
    geminiProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      hasReceivedStderr = true;
      
      // 1. Check for fatal errors that should trigger model fallback
      if (errorMsg.includes('Resource has been exhausted') || 
          errorMsg.includes('Quota exceeded') || 
          errorMsg.includes('Rate limit reached') ||
          errorMsg.includes('429') ||
          errorMsg.includes('ModelNotFoundError') ||
          errorMsg.includes('404') ||
          errorMsg.includes('400') ||
          errorMsg.includes('INVALID_ARGUMENT') ||
          errorMsg.includes('Thinking_config.include_thoughts') ||
          errorMsg.includes('No capacity available') ||
          errorMsg.includes('An unexpected critical error occurred')) {
        quotaReached = true; 
        clearTimeout(timeout); // Clear timeout immediately on recognized fatal error
        return;
      }

      // 2. Filter out noisy but non-fatal internal messages (don't show to user, don't trigger fallback)
      if (errorMsg.includes('Approval mode "plan" is only available') ||
          errorMsg.includes('Falling back to "default"') ||
          errorMsg.includes('--allowed-tools cli argument and tools.allowed in settings.json are deprecated') ||
          errorMsg.includes('Migrate to Policy Engine') ||
          errorMsg.includes('[DEP0040]') || 
          errorMsg.includes('DeprecationWarning') ||
          errorMsg.includes('--trace-deprecation') ||
          errorMsg.includes('Loaded cached credentials')) {
        return;
      }
      
      const currentId = capturedSessionId || sessionId || processKey;
      ws.send(JSON.stringify({ type: 'gemini-error', sessionId: currentId, error: errorMsg }));
    });
    
    geminiProcess.on('close', async (code) => {
      clearTimeout(timeout);
      if (responseHandler) {
        responseHandler.forceFlush();
        responseHandler.destroy();
      }
      
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeGeminiProcesses.delete(finalSessionId);
      
      if (quotaReached) {
        const currentIndex = modelOrder.indexOf(currentModel);
        if (currentIndex !== -1 && currentIndex < modelOrder.length - 1) {
          const nextModel = modelOrder[currentIndex + 1];
          // Send status to UI so it can update the model selector silently
          ws.send(JSON.stringify({
            type: 'gemini-status',
            sessionId: finalSessionId,
            data: { 
              message: 'Optimizing...', 
              fallbackModel: nextModel 
            }
          }));
          
          const newOptions = { ...options, model: nextModel };
          try {
            await spawnGemini(command, newOptions, ws);
            resolve();
            return;
          } catch (err) {
            reject(err);
            return;
          }
        }
      }

      if (finalSessionId && fullResponse) {
        sessionManager.addMessage(finalSessionId, 'assistant', fullResponse);
      }
      
      ws.send(JSON.stringify({
        type: 'gemini-complete',
        sessionId: finalSessionId,
        exitCode: code,
        isNewSession: !sessionId && !!command
      }));
      
      if (geminiProcess.tempImagePaths) {
        for (const imagePath of geminiProcess.tempImagePaths) {
          await fs.unlink(imagePath).catch(() => {});
        }
        if (geminiProcess.tempDir) {
          await fs.rm(geminiProcess.tempDir, { recursive: true, force: true }).catch(() => {});
        }
      }
      
      if (code === 0 || quotaReached) resolve();
      else reject(new Error(`Gemini CLI exited with code ${code}`));
    });
    
    geminiProcess.on('error', (error) => {
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeGeminiProcesses.delete(finalSessionId);
      ws.send(JSON.stringify({ type: 'gemini-error', sessionId: finalSessionId, error: error.message }));
      reject(error);
    });
  });
}

function abortGeminiSession(sessionId) {
  // Debug - Attempting to abort Gemini session
  // Debug - Active processes
  
  // Try to find the process by session ID or any key that contains the session ID
  let process = activeGeminiProcesses.get(sessionId);
  let processKey = sessionId;
  
  if (!process) {
    // Search for process with matching session ID in keys
    for (const [key, proc] of activeGeminiProcesses.entries()) {
      if (key.includes(sessionId) || sessionId.includes(key)) {
        process = proc;
        processKey = key;
        break;
      }
    }
  }
  
  if (process) {
    // Debug - Found process for session
    try {
      // First try SIGTERM
      process.kill('SIGTERM');
      
      // Set a timeout to force kill if process doesn't exit
      setTimeout(() => {
        if (activeGeminiProcesses.has(processKey)) {
          // Debug - Process didn't terminate, forcing kill
          try {
            process.kill('SIGKILL');
          } catch (e) {
            // console.error('Error force killing process:', e);
          }
        }
      }, 2000); // Wait 2 seconds before force kill
      
      activeGeminiProcesses.delete(processKey);
      return true;
    } catch (error) {
      // console.error('Error killing process:', error);
      activeGeminiProcesses.delete(processKey);
      return false;
    }
  }
  
  // Debug - No process found for session
  return false;
}

export {
  spawnGemini,
  abortGeminiSession
};