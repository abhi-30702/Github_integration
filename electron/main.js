const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, session } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

const isDev = !app.isPackaged;

require('dotenv').config({
  path: isDev
    ? path.join(__dirname, '../.env')
    : path.join(process.resourcesPath, '.env'),
});
let mainWindow;

// ── Single instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('github-dashboard://'));
    if (url) handleProtocolUrl(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── Config (userData/github-dashboard-config.json) ───────────────────────────

function configPath() {
  return path.join(app.getPath('userData'), 'github-dashboard-config.json');
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); }
  catch { return {}; }
}

function writeConfig(updates) {
  const current = readConfig();
  fs.writeFileSync(configPath(), JSON.stringify({ ...current, ...updates }, null, 2));
}

// ── Token (safeStorage / DPAPI) ───────────────────────────────────────────────

function saveToken(token) {
  const encrypted = safeStorage.encryptString(token).toString('base64');
  writeConfig({ encryptedToken: encrypted });
}

function loadToken() {
  const { encryptedToken } = readConfig();
  if (!encryptedToken) return null;
  try { return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64')); }
  catch { return null; }
}

function clearToken() {
  writeConfig({ encryptedToken: null, userLogin: null });
}

// ── GitHub REST ───────────────────────────────────────────────────────────────

function githubGet(apiPath, token) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'GitHub-Dashboard-App/1.0',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          else resolve(parsed);
        } catch { reject(new Error('Invalid JSON from GitHub API')); }
      });
    }).on('error', reject);
  });
}

function githubPost(hostname, apiPath, extraHeaders, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...extraHeaders,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function githubGraphQL(query, token) {
  return githubPost('api.github.com', '/graphql', {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'GitHub-Dashboard-App/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }, { query });
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

let pendingOAuthResolve = null;
let pendingOAuthReject  = null;

function handleProtocolUrl(url) {
  try {
    const parsed = new URL(url);
    const code  = parsed.searchParams.get('code');
    const error = parsed.searchParams.get('error');
    if (error && pendingOAuthReject) {
      pendingOAuthReject(new Error(error));
    } else if (code && pendingOAuthResolve) {
      exchangeCode(code).then(pendingOAuthResolve).catch(pendingOAuthReject);
    }
  } finally {
    pendingOAuthResolve = null;
    pendingOAuthReject  = null;
  }
}

async function exchangeCode(code) {
  const data = await githubPost(
    'github.com',
    '/login/oauth/access_token',
    {},
    {
      client_id:     process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }
  );
  if (!data.access_token) throw new Error(data.error_description || 'OAuth token exchange failed');
  return data.access_token;
}

// ── File Watcher ──────────────────────────────────────────────────────────────

let watcher = null;

function startWatcher(watchDir) {
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  const chokidar = require('chokidar');
  watcher = chokidar.watch(watchDir, {
    depth: 0,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: false,
  });

  watcher.on('addDir', (folderPath) => {
    if (folderPath === watchDir) return;
    const { skippedFolders = [] } = readConfig();
    if (skippedFolders.includes(folderPath)) return;
    const folderName = path.basename(folderPath);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('folder-detected', { folderName, folderPath });
    }
  });

  watcher.on('error', (err) => {
    console.error('Watcher error:', err.message);
  });
}

// ── IPC: Auth ─────────────────────────────────────────────────────────────────

ipcMain.handle('oauth:start', () => {
  return new Promise((resolve, reject) => {
    pendingOAuthResolve = async (token) => {
      saveToken(token);
      const user = await githubGet('/user', token);
      writeConfig({ userLogin: user.login });
      resolve({ user });
    };
    pendingOAuthReject = (err) => reject(err);

    const scope = 'repo%20user%20read:org';
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=github-dashboard://oauth/callback&scope=${scope}`;
    shell.openExternal(authUrl);

    setTimeout(() => {
      if (pendingOAuthReject) {
        pendingOAuthReject(new Error('Authentication timed out after 5 minutes'));
        pendingOAuthResolve = null;
        pendingOAuthReject  = null;
      }
    }, 5 * 60 * 1000);
  });
});

ipcMain.handle('auth:get-state', async () => {
  const token = loadToken();
  if (!token) return { user: null };
  try {
    const user = await githubGet('/user', token);
    if (!readConfig().userLogin) writeConfig({ userLogin: user.login });
    return { user };
  } catch {
    clearToken();
    return { user: null };
  }
});

ipcMain.handle('oauth:signout', () => {
  clearToken();
});

// ── IPC: GitHub Data ──────────────────────────────────────────────────────────

ipcMain.handle('github:fetch-repos', async () => {
  const token = loadToken();
  return githubGet('/user/repos?sort=updated&per_page=30&affiliation=owner', token);
});

ipcMain.handle('github:fetch-activity', async () => {
  const token = loadToken();
  const { userLogin } = readConfig();
  const login = userLogin || (await githubGet('/user', token)).login;
  return githubGet(`/users/${encodeURIComponent(login)}/events?per_page=20`, token);
});

ipcMain.handle('github:fetch-contributions', async () => {
  const token = loadToken();
  const { userLogin } = readConfig();
  const login = userLogin || (await githubGet('/user', token)).login;
  const from  = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const to    = new Date().toISOString();
  const query = `{
    user(login: "${login}") {
      contributionsCollection(from: "${from}", to: "${to}") {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { contributionCount date }
          }
        }
      }
    }
  }`;
  return githubGraphQL(query, token);
});

ipcMain.handle('github:create-repo', async (_, { name, description, isPrivate, localPath }) => {
  const token = loadToken();

  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error('Invalid repository name. Use only letters, numbers, hyphens, underscores, and dots.');
  }

  const repo = await githubPost('api.github.com', '/user/repos', {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'GitHub-Dashboard-App/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }, { name, description: description || '', private: isPrivate, auto_init: false });

  if (!repo.clone_url) throw new Error(repo.message || 'Failed to create repository');

  if (localPath && fs.existsSync(localPath)) {
    try {
      execSync('git init', { cwd: localPath, stdio: 'ignore' });
      execSync(`git remote add origin ${repo.clone_url}`, { cwd: localPath, stdio: 'ignore' });
    } catch (err) {
      console.warn('git init/remote failed:', err.message);
    }
  }

  return { cloneUrl: repo.clone_url, htmlUrl: repo.html_url, name: repo.name };
});

// ── IPC: File Watcher ─────────────────────────────────────────────────────────

ipcMain.handle('watcher:get-dir', () => readConfig().watchedDir || null);

ipcMain.handle('watcher:pick-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select your projects folder',
    buttonLabel: 'Watch this folder',
  });
  if (result.canceled || !result.filePaths.length) return null;
  const dir = result.filePaths[0];
  writeConfig({ watchedDir: dir });
  startWatcher(dir);
  return dir;
});

ipcMain.handle('watcher:skip-folder', (_, folderPath) => {
  const { skippedFolders = [] } = readConfig();
  if (!skippedFolders.includes(folderPath)) {
    writeConfig({ skippedFolders: [...skippedFolders, folderPath] });
  }
});

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // CSP — allow GitHub API + Google Fonts
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          "script-src 'self' 'unsafe-inline';" +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
          "font-src 'self' data: https://fonts.gstatic.com;" +
          "img-src 'self' data: https:;" +
          "connect-src 'self' https://api.github.com https://github.com;"
        ],
      },
    });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const { watchedDir } = readConfig();
    if (watchedDir) startWatcher(watchedDir);
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient('github-dashboard');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
