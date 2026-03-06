import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import readline from 'readline';

// Cache for extracted project directories
const projectDirectoryCache = new Map();
let cacheTimestamp = Date.now();

// Cache for full projects list
let projectsListCache = null;
let projectsListCacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

// Clear cache when needed (called when project files change)
function clearProjectDirectoryCache() {
  projectDirectoryCache.clear();
  projectsListCache = null;
  projectsListCacheTimestamp = 0;
  cacheTimestamp = Date.now();
}

// Load project configuration file
async function loadProjectConfig() {
  const configPath = path.join(process.env.HOME, '.gemini', 'project-config.json');
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // Return empty config if file doesn't exist
    return {};
  }
}

// Save project configuration file
async function saveProjectConfig(config) {
  const configPath = path.join(process.env.HOME, '.gemini', 'project-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// Generate better display name from path
async function generateDisplayName(projectName, actualProjectDir = null) {
  // Use actual project directory if provided, otherwise decode from project name
  let projectPath = actualProjectDir || projectName.replace(/-/g, '/');
  
  // Try to read package.json from the project path
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);
    
    // Return the name from package.json if it exists
    if (packageJson.name) {
      return packageJson.name;
    }
  } catch (error) {
    // Fall back to path-based naming if package.json doesn't exist or can't be read
  }
  
  // If it starts with /, it's an absolute path
  if (projectPath.startsWith('/')) {
    const parts = projectPath.split('/').filter(Boolean);
    if (parts.length > 3) {
      // Show last 2 folders with ellipsis: "...projects/myapp"
      return `.../${parts.slice(-2).join('/')}`;
    } else {
      // Show full path if short: "/home/user"
      return projectPath;
    }
  }
  
  return projectPath;
}

// Extract the actual project directory from JSONL sessions (with caching)
// Extract the actual project directory from JSONL sessions (with caching)
async function extractProjectDirectory(projectName) {
  // Check memory cache first
  if (projectDirectoryCache.has(projectName)) {
    return projectDirectoryCache.get(projectName);
  }
  
  const projectDir = path.join(process.env.HOME, '.gemini', 'projects', projectName);
  let extractedPath = null;
  
  try {
    // Try to decode from name first as a fast fallback
    try {
      let base64Name = projectName.replace(/_/g, '+').replace(/-/g, '/');
      if (base64Name.endsWith('++')) {
        base64Name = base64Name.slice(0, -2) + '==';
      }
      extractedPath = Buffer.from(base64Name, 'base64').toString('utf8');
      extractedPath = extractedPath.replace(/[^\x20-\x7E]/g, '').trim();
      
      // If it looks like a valid path, we can use it as a candidate
      if (extractedPath && (extractedPath.startsWith('/') || extractedPath.includes('\\'))) {
        // We still check sessions if they exist to be sure, but we have a good candidate
      } else {
        extractedPath = null;
      }
    } catch (e) {
      extractedPath = null;
    }

    const files = await fs.readdir(projectDir).catch(() => []);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length > 0) {
      // Just check the most recent session file to save time
      // Sort by mtime to find the latest
      const fileStats = await Promise.all(
        jsonlFiles.map(async (file) => {
          const stats = await fs.stat(path.join(projectDir, file));
          return { file, mtime: stats.mtimeMs };
        })
      );
      
      fileStats.sort((a, b) => b.mtime - a.mtime);
      
      // Try the latest 3 files at most
      for (let i = 0; i < Math.min(3, fileStats.length); i++) {
        const jsonlFile = path.join(projectDir, fileStats[i].file);
        
        // Use a faster way to read just a bit of the file
        // Read the last 4KB of the file which likely contains the most recent CWD
        try {
          const stats = await fs.stat(jsonlFile);
          const fd = await fs.open(jsonlFile, 'r');
          const bufferSize = Math.min(stats.size, 4096);
          const buffer = Buffer.alloc(bufferSize);
          
          await fd.read(buffer, 0, bufferSize, stats.size - bufferSize);
          await fd.close();
          
          const lastLines = buffer.toString().split('\n').filter(Boolean).reverse();
          for (const line of lastLines) {
            try {
              const entry = JSON.parse(line);
              if (entry.cwd) {
                extractedPath = entry.cwd;
                break;
              }
            } catch (e) {}
          }
        } catch (e) {
          // Fallback to stream if direct read fails
          const fileStream = fsSync.createReadStream(jsonlFile, { start: Math.max(0, (await fs.stat(jsonlFile)).size - 10000) });
          const rl = readline.createInterface({ input: fileStream });
          for await (const line of rl) {
            try {
              const entry = JSON.parse(line);
              if (entry.cwd) extractedPath = entry.cwd;
            } catch (e) {}
          }
        }
        
        if (extractedPath) break;
      }
    }
    
    // Final fallback if still nothing
    if (!extractedPath) {
      extractedPath = projectName.replace(/-/g, '/');
    }
    
    // Clean and cache
    extractedPath = extractedPath.replace(/[^\x20-\x7E]/g, '').trim();
    projectDirectoryCache.set(projectName, extractedPath);
    return extractedPath;
    
  } catch (error) {
    // console.error(`Error extracting project directory for ${projectName}:`, error);
    // Fall back to decoded project name
    try {
      // Handle custom padding: __ at the end should be replaced with ==
      let base64Name = projectName.replace(/_/g, '+').replace(/-/g, '/');
      if (base64Name.endsWith('++')) {
        base64Name = base64Name.slice(0, -2) + '==';
      }
      extractedPath = Buffer.from(base64Name, 'base64').toString('utf8');
      // Clean the path by removing any non-printable characters
      extractedPath = extractedPath.replace(/[^\x20-\x7E]/g, '').trim();
    } catch (e) {
      extractedPath = projectName.replace(/-/g, '/');
    }
    
    // Cache the fallback result too
    projectDirectoryCache.set(projectName, extractedPath);
    
    return extractedPath;
  }
}

async function getProjects() {
  // Use cache if available and not expired
  const now = Date.now();
  if (projectsListCache && (now - projectsListCacheTimestamp < CACHE_TTL)) {
    return projectsListCache;
  }

  const geminiDir = path.join(process.env.HOME, '.gemini', 'projects');
  const config = await loadProjectConfig();
  const projects = [];
  const existingProjects = new Set();
  
  try {
    // First, get existing projects from the file system
    const entries = await fs.readdir(geminiDir, { withFileTypes: true });
    
    // Process projects in parallel for better performance
    const projectPromises = entries.map(async (entry) => {
      if (entry.isDirectory()) {
        existingProjects.add(entry.name);
        
        // Extract actual project directory from JSONL sessions
        const actualProjectDir = await extractProjectDirectory(entry.name);
        
        // Get display name from config or generate one
        const customName = config[entry.name]?.displayName;
        const autoDisplayName = await generateDisplayName(entry.name, actualProjectDir);
        
        const project = {
          name: entry.name,
          path: actualProjectDir,
          displayName: customName || autoDisplayName,
          fullPath: actualProjectDir,
          isCustomName: !!customName,
          sessions: []
        };
        
        // Optimized session loading: only get recent sessions if explicitly needed
        // For the main list, we'll just get the session metadata
        try {
          const sessionManager = (await import('./sessionManager.js')).default;
          const allSessions = sessionManager.getProjectSessions(actualProjectDir);
          
          // Only include the most recent 3 sessions for the main list
          project.sessions = allSessions.slice(0, 3);
          project.sessionMeta = {
            hasMore: allSessions.length > 3,
            total: allSessions.length
          };
        } catch (e) {
          // console.warn(`Could not load sessions for project ${entry.name}:`, e.message);
        }
        
        return project;
      }
      return null;
    });

    const results = await Promise.all(projectPromises);
    projects.push(...results.filter(p => p !== null));
  } catch (error) {
    // console.error('Error reading projects directory:', error);
  }
  
  // Add manually configured projects that don't exist as folders yet
  for (const [projectName, projectConfig] of Object.entries(config)) {
    if (!existingProjects.has(projectName) && projectConfig.manuallyAdded) {
      let actualProjectDir = projectConfig.originalPath;
      
      if (!actualProjectDir) {
        try {
          actualProjectDir = await extractProjectDirectory(projectName);
        } catch (error) {
          actualProjectDir = projectName.replace(/-/g, '/');
        }
      }
      
      const project = {
        name: projectName,
        path: actualProjectDir,
        displayName: projectConfig.displayName || await generateDisplayName(projectName, actualProjectDir),
        fullPath: actualProjectDir,
        isCustomName: !!projectConfig.displayName,
        isManuallyAdded: true,
        sessions: []
      };
      
      projects.push(project);
    }
  }
  
  // Sort projects by display name initially
  projects.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  
  // Update cache
  projectsListCache = projects;
  projectsListCacheTimestamp = now;
  
  return projects;
}

async function getSessions(projectName, limit = 5, offset = 0) {
  const projectDir = path.join(process.env.HOME, '.gemini', 'projects', projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      return { sessions: [], hasMore: false, total: 0 };
    }
    
    // For performance, get file stats to sort by modification time
    const filesWithStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(projectDir, file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime };
      })
    );
    
    // Sort files by modification time (newest first) for better performance
    filesWithStats.sort((a, b) => b.mtime - a.mtime);
    
    const allSessions = new Map();
    let processedCount = 0;
    
    // Process files in order of modification time
    for (const { file } of filesWithStats) {
      const jsonlFile = path.join(projectDir, file);
      const sessions = await parseJsonlSessions(jsonlFile);
      
      // Merge sessions, avoiding duplicates by session ID
      sessions.forEach(session => {
        if (!allSessions.has(session.id)) {
          allSessions.set(session.id, session);
        }
      });
      
      processedCount++;
      
      // Early exit optimization: if we have enough sessions and processed recent files
      if (allSessions.size >= (limit + offset) * 2 && processedCount >= Math.min(3, filesWithStats.length)) {
        break;
      }
    }
    
    // Convert to array and sort by last activity
    const sortedSessions = Array.from(allSessions.values()).sort((a, b) => 
      new Date(b.lastActivity) - new Date(a.lastActivity)
    );
    
    const total = sortedSessions.length;
    const paginatedSessions = sortedSessions.slice(offset, offset + limit);
    const hasMore = offset + limit < total;
    
    return {
      sessions: paginatedSessions,
      hasMore,
      total,
      offset,
      limit
    };
  } catch (error) {
    // console.error(`Error reading sessions for project ${projectName}:`, error);
    return { sessions: [], hasMore: false, total: 0 };
  }
}

async function parseJsonlSessions(filePath) {
  const sessions = new Map();
  
  try {
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    // Debug - [JSONL Parser] Reading file
    let lineCount = 0;
    
    for await (const line of rl) {
      if (line.trim()) {
        lineCount++;
        try {
          const entry = JSON.parse(line);
          
          if (entry.sessionId) {
            if (!sessions.has(entry.sessionId)) {
              sessions.set(entry.sessionId, {
                id: entry.sessionId,
                summary: 'New Session',
                messageCount: 0,
                lastActivity: new Date(),
                cwd: entry.cwd || ''
              });
            }
            
            const session = sessions.get(entry.sessionId);
            
            // Update summary if this is a summary entry
            if (entry.type === 'summary' && entry.summary) {
              session.summary = entry.summary;
            } else if (entry.message?.role === 'user' && entry.message?.content && session.summary === 'New Session') {
              // Use first user message as summary if no summary entry exists
              const content = entry.message.content;
              if (typeof content === 'string' && content.length > 0) {
                // Skip command messages that start with <command-name>
                if (!content.startsWith('<command-name>')) {
                  session.summary = content.length > 50 ? content.substring(0, 50) + '...' : content;
                }
              }
            }
            
            // Count messages instead of storing them all
            session.messageCount = (session.messageCount || 0) + 1;
            
            // Update last activity
            if (entry.timestamp) {
              session.lastActivity = new Date(entry.timestamp);
            }
          }
        } catch (parseError) {
          // console.warn(`[JSONL Parser] Error parsing line ${lineCount}:`, parseError.message);
        }
      }
    }
    
    // Debug - [JSONL Parser] Processed lines and found sessions
  } catch (error) {
    // console.error('Error reading JSONL file:', error);
  }
  
  // Convert Map to Array and sort by last activity
  return Array.from(sessions.values()).sort((a, b) => 
    new Date(b.lastActivity) - new Date(a.lastActivity)
  );
}

// Get messages for a specific session
async function getSessionMessages(projectName, sessionId) {
  const projectDir = path.join(process.env.HOME, '.gemini', 'projects', projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      return [];
    }
    
    const messages = [];
    
    // Process all JSONL files to find messages for this session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const fileStream = fsSync.createReadStream(jsonlFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      for await (const line of rl) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line);
            if (entry.sessionId === sessionId) {
              messages.push(entry);
            }
          } catch (parseError) {
            // console.warn('Error parsing line:', parseError.message);
          }
        }
      }
    }
    
    // Sort messages by timestamp
    return messages.sort((a, b) => 
      new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );
  } catch (error) {
    // console.error(`Error reading messages for session ${sessionId}:`, error);
    return [];
  }
}

// Rename a project's display name
async function renameProject(projectName, newDisplayName) {
  const config = await loadProjectConfig();
  
  if (!newDisplayName || newDisplayName.trim() === '') {
    // Remove custom name if empty, will fall back to auto-generated
    delete config[projectName];
  } else {
    // Set custom display name
    config[projectName] = {
      displayName: newDisplayName.trim()
    };
  }
  
  await saveProjectConfig(config);
  return true;
}

// Delete a session from a project
async function deleteSession(projectName, sessionId) {
  const projectDir = path.join(process.env.HOME, '.gemini', 'projects', projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      throw new Error('No session files found for this project');
    }
    
    // Check all JSONL files to find which one contains the session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const content = await fs.readFile(jsonlFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Check if this file contains the session
      const hasSession = lines.some(line => {
        try {
          const data = JSON.parse(line);
          return data.sessionId === sessionId;
        } catch {
          return false;
        }
      });
      
      if (hasSession) {
        // Filter out all entries for this session
        const filteredLines = lines.filter(line => {
          try {
            const data = JSON.parse(line);
            return data.sessionId !== sessionId;
          } catch {
            return true; // Keep malformed lines
          }
        });
        
        // Write back the filtered content
        await fs.writeFile(jsonlFile, filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : ''));
        return true;
      }
    }
    
    throw new Error(`Session ${sessionId} not found in any files`);
  } catch (error) {
    // console.error(`Error deleting session ${sessionId} from project ${projectName}:`, error);
    throw error;
  }
}

// Check if a project is empty (has no sessions)
async function isProjectEmpty(projectName) {
  try {
    const sessionsResult = await getSessions(projectName, 1, 0);
    return sessionsResult.total === 0;
  } catch (error) {
    // console.error(`Error checking if project ${projectName} is empty:`, error);
    return false;
  }
}

// Delete an empty project
async function deleteProject(projectName) {
  const projectDir = path.join(process.env.HOME, '.gemini', 'projects', projectName);
  
  try {
    // First check if the project is empty
    const isEmpty = await isProjectEmpty(projectName);
    if (!isEmpty) {
      throw new Error('Cannot delete project with existing sessions');
    }
    
    // Remove the project directory
    await fs.rm(projectDir, { recursive: true, force: true });
    
    // Remove from project config
    const config = await loadProjectConfig();
    delete config[projectName];
    await saveProjectConfig(config);
    
    return true;
  } catch (error) {
    // console.error(`Error deleting project ${projectName}:`, error);
    throw error;
  }
}

// Add a project manually to the config (create folder if needed)
async function addProjectManually(projectPath, displayName = null) {
  const absolutePath = path.resolve(projectPath);
  
  try {
    // Check if the path exists
    await fs.access(absolutePath);
  } catch (error) {
    // If path doesn't exist, try to create it
    if (error.code === 'ENOENT') {
      try {
        await fs.mkdir(absolutePath, { recursive: true });
        console.log(`Created new directory: ${absolutePath}`);
      } catch (mkdirError) {
        throw new Error(`Failed to create directory: ${absolutePath} - ${mkdirError.message}`);
      }
    } else {
      throw new Error(`Cannot access path: ${absolutePath} - ${error.message}`);
    }
  }
  
  // Generate project name (encode path for use as directory name)
  // Use base64 encoding to handle all path characters safely
  const projectName = Buffer.from(absolutePath).toString('base64').replace(/[/+=]/g, '_');
  
  // Check if project already exists in config or as a folder
  const config = await loadProjectConfig();
  const projectDir = path.join(process.env.HOME, '.gemini', 'projects', projectName);
  
  try {
    await fs.access(projectDir);
    throw new Error(`Project already exists for path: ${absolutePath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  
  if (config[projectName]) {
    throw new Error(`Project already configured for path: ${absolutePath}`);
  }
  
  // Add to config as manually added project
  config[projectName] = {
    manuallyAdded: true,
    originalPath: absolutePath
  };
  
  if (displayName) {
    config[projectName].displayName = displayName;
  }
  
  await saveProjectConfig(config);
  
  // Create the project directory
  try {
    await fs.mkdir(projectDir, { recursive: true });
  } catch (error) {
    // console.error('Error creating project directory:', error);
  }
  
  return {
    name: projectName,
    path: absolutePath,
    fullPath: absolutePath,
    displayName: displayName || await generateDisplayName(projectName, absolutePath),
    isManuallyAdded: true,
    sessions: []
  };
}


export {
  getProjects,
  getSessions,
  getSessionMessages,
  parseJsonlSessions,
  renameProject,
  deleteSession,
  isProjectEmpty,
  deleteProject,
  addProjectManually,
  loadProjectConfig,
  saveProjectConfig,
  extractProjectDirectory,
  clearProjectDirectoryCache
};