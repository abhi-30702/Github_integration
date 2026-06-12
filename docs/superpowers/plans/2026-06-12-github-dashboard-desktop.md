# GitHub Dashboard Desktop App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing React GitHub Dashboard from a CRA web app with mock data into a packaged Windows `.exe` desktop app with GitHub OAuth login, live API data, and automatic repo creation when new project folders are detected.

**Architecture:** Electron wraps the existing CRA React app. The Electron main process owns all Node.js work — OAuth flow, GitHub API calls, file watching, token storage — and exposes a typed `window.electronAPI` bridge to the renderer via a secure `contextBridge` preload. React never touches Node.js directly.

**Tech Stack:** Electron 29, CRA/React 18, chokidar 3, @octokit-free https module, safeStorage (DPAPI), electron-builder NSIS, dotenv, concurrently, wait-on

---

## File Map

**New files:**
- `electron/main.js` — Electron main process (OAuth, API, watcher, IPC)
- `electron/preload.js` — contextBridge: exposes `window.electronAPI` to renderer
- `electron-builder.yml` — NSIS installer config
- `.env.example` — OAuth credentials template
- `src/context/AuthContext.js` — Auth state provider
- `src/hooks/useGitHub.js` — Data fetching hook + API mappers
- `src/pages/LoginPage.js` — Sign-in screen
- `src/pages/DashboardPage.js` — Main dashboard (refactored from App.js)
- `src/components/CreateRepoModal.js` — Folder-detected / new project modal
- `src/components/WatchDirModal.js` — First-launch directory picker
- `src/components/Toast.js` — Success/error notification

**Modified files:**
- `package.json` — add Electron deps, update scripts, add `"main"` + `"homepage"`
- `src/App.js` — routing only (LoginPage vs DashboardPage)
- `src/components/ProfileCard.js` — accept `profile` + `languages` props instead of `data.js`
- `src/components/ContributionGrid.js` — accept `weeks` + `total` props
- `src/components/ActivityFeed.js` — accept `events` prop
- `.gitignore` — add `.env`, `dist/`

**Deleted:**
- `src/data.js` — replaced entirely by live GitHub API data

---

## Task 1 — Scaffold Electron, install deps, update package.json

**Files:**
- Modify: `package.json`
- Create: `electron/main.js`
- Create: `electron/preload.js` (skeleton)

- [ ] **Step 1: Update package.json**

Replace the entire content of `package.json` with:

```json
{
  "name": "github-dashboard",
  "version": "1.0.0",
  "description": "GitHub Integration Dashboard — Desktop App",
  "private": true,
  "main": "electron/main.js",
  "homepage": ".",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "dev": "concurrently \"react-scripts start\" \"wait-on http://localhost:3000 && electron .\"",
    "dist": "react-scripts build && electron-builder --win"
  },
  "dependencies": {
    "chokidar": "^3.6.0",
    "dotenv": "^16.4.5",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.1"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "electron": "^29.0.0",
    "electron-builder": "^24.13.3",
    "wait-on": "^7.2.0"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: installs without error. `node_modules/electron` and `node_modules/chokidar` now present.

- [ ] **Step 3: Create electron/main.js — minimal BrowserWindow**

Create `electron/main.js`:

```js
const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

let mainWindow;

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
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 4: Create electron/preload.js — skeleton**

Create `electron/preload.js`:

```js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
});
```

- [ ] **Step 5: Verify app launches**

```bash
npm run dev
```

Expected: CRA dev server starts on port 3000, then Electron window opens showing the React app. No console errors about preload. Close the window.

- [ ] **Step 6: Commit**

```bash
git add electron/ package.json
git commit -m "feat: scaffold Electron entry point with secure BrowserWindow"
```

---

## Task 2 — Secure BrowserWindow + full preload contextBridge

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.js`

- [ ] **Step 1: Add security headers + full preload bridge to main.js**

Replace the contents of `electron/main.js` with the full secure version. Add these imports at the top and the session CSP hook before `createWindow`:

```js
const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, session } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const isDev = !app.isPackaged;
let mainWindow;

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

  // CSP headers — allow GitHub API + Google Fonts (used in index.html)
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

function startWatcher(watchDir) {
  // Implemented in Task 11
}

// ── IPC handlers (added in later tasks) ──────────────────────────────────────

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

- [ ] **Step 2: Update preload.js with full contextBridge**

Replace `electron/preload.js` with:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  startOAuth:   ()        => ipcRenderer.invoke('oauth:start'),
  signOut:      ()        => ipcRenderer.invoke('oauth:signout'),
  getAuthState: ()        => ipcRenderer.invoke('auth:get-state'),

  // GitHub data
  fetchRepos:          () => ipcRenderer.invoke('github:fetch-repos'),
  fetchActivity:       () => ipcRenderer.invoke('github:fetch-activity'),
  fetchContributions:  () => ipcRenderer.invoke('github:fetch-contributions'),

  // Repo creation
  createRepo: (opts)      => ipcRenderer.invoke('github:create-repo', opts),

  // File watcher
  pickWatchDir:  ()       => ipcRenderer.invoke('watcher:pick-dir'),
  getWatchDir:   ()       => ipcRenderer.invoke('watcher:get-dir'),
  skipFolder: (fp)        => ipcRenderer.invoke('watcher:skip-folder', fp),
  onFolderDetected: (cb)  => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('folder-detected', handler);
    return () => ipcRenderer.removeListener('folder-detected', handler);
  },
});
```

- [ ] **Step 3: Verify sandbox doesn't break existing UI**

```bash
npm run dev
```

Expected: app still renders. Open DevTools console — no errors about `window.electronAPI`. Check `window.electronAPI.getAuthState` exists (will return undefined until IPC handlers are wired). Close app.

- [ ] **Step 4: Commit**

```bash
git add electron/main.js electron/preload.js
git commit -m "feat: secure BrowserWindow with CSP, contextIsolation, safeStorage helpers"
```

---

## Task 3 — Environment setup (.env, .gitignore, OAuth App)

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create .env.example**

Create `.env.example`:

```
# GitHub OAuth App credentials
# Create an OAuth App at: https://github.com/settings/developers
# Set the callback URL to: github-dashboard://callback
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

- [ ] **Step 2: Create your real .env file**

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then go to https://github.com/settings/developers → "OAuth Apps" → "New OAuth App":
- **Application name:** GitHub Dashboard
- **Homepage URL:** `http://localhost:3000`
- **Authorization callback URL:** `github-dashboard://callback`

Click "Register application", then "Generate a new client secret".

Paste the Client ID and Client Secret into your `.env` file.

- [ ] **Step 3: Update .gitignore**

Add these lines to `.gitignore` (create it if it doesn't exist):

```
# env
.env

# Electron build output
dist/
release/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 4: Verify .env is loaded**

In `electron/main.js`, `require('dotenv').config(...)` is already at the top. Verify:

```bash
npm run dev
```

In Electron DevTools console, type:
```js
// Nothing — env vars are in main process only, not renderer (security)
// Verify in main process by adding a temporary log to main.js:
// console.log('CLIENT_ID:', process.env.GITHUB_CLIENT_ID);
```

Add `console.log('CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? 'set' : 'MISSING');` temporarily to `createWindow()`, run `npm run dev`, check the terminal output. Then remove the log line.

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore
git commit -m "feat: add OAuth env config and gitignore"
```

---

## Task 4 — OAuth flow in main.js

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Add single-instance lock + protocol handler to main.js**

Add this block directly after the `require('dotenv')` line and before `createWindow`:

```js
// Single instance — required for protocol redirect on Windows
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
```

- [ ] **Step 2: Add OAuth helpers to main.js**

Add these functions after the `githubGraphQL` function (before `createWindow`):

```js
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
```

- [ ] **Step 3: Add IPC handlers for auth to main.js**

Add these after the `startWatcher` placeholder function, before the app lifecycle section:

```js
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
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=github-dashboard://callback&scope=${scope}`;
    shell.openExternal(authUrl);

    // 5-minute timeout
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
```

- [ ] **Step 4: Register the custom URL protocol**

Add this inside `app.whenReady().then(...)`, before `createWindow()`:

```js
app.whenReady().then(() => {
  app.setAsDefaultProtocolClient('github-dashboard');
  createWindow();
});
```

Replace the existing `app.whenReady().then(createWindow)` line with the above.

- [ ] **Step 5: Verify protocol handler wires up**

```bash
npm run dev
```

In Electron's detached DevTools, run:
```js
window.electronAPI.getAuthState().then(console.log)
// Expected: { user: null }  (no token yet)
```

No errors. Close app.

- [ ] **Step 6: Commit**

```bash
git add electron/main.js
git commit -m "feat: GitHub OAuth flow with custom protocol, DPAPI token storage"
```

---

## Task 5 — AuthContext + LoginPage + App routing

**Files:**
- Create: `src/context/AuthContext.js`
- Create: `src/pages/LoginPage.js`
- Modify: `src/App.js`

- [ ] **Step 1: Create src/context/AuthContext.js**

```js
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.getAuthState()
      .then(({ user: u }) => setUser(u || null))
      .finally(() => setLoading(false));
  }, []);

  const login  = (userData) => setUser(userData);
  const logout = async () => {
    await window.electronAPI.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 2: Write test for AuthContext**

Create `src/context/AuthContext.test.js`:

```js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the electronAPI
beforeAll(() => {
  window.electronAPI = {
    getAuthState: jest.fn().mockResolvedValue({ user: { login: 'testuser', name: 'Test User' } }),
    signOut: jest.fn().mockResolvedValue(),
  };
});

function DisplayUser() {
  const { user, loading } = useAuth();
  if (loading) return <span>loading</span>;
  return <span>{user ? user.login : 'no-user'}</span>;
}

test('loads user from getAuthState on mount', async () => {
  render(<AuthProvider><DisplayUser /></AuthProvider>);
  expect(screen.getByText('loading')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument());
});
```

- [ ] **Step 3: Run the test**

```bash
npx react-scripts test --watchAll=false src/context/AuthContext.test.js
```

Expected: 1 test passes.

- [ ] **Step 4: Create src/pages/LoginPage.js**

```js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const GH_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

export default function LoginPage() {
  const { login }             = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await window.electronAPI.startOAuth();
      login(user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '2.5rem', width: 360, textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>🦁</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '.4rem' }}>GitHub Dashboard</div>
        <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.5 }}>
          Sign in to see your live repositories, contributions, and activity feed.
        </div>

        <button onClick={handleSignIn} disabled={loading} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
          background: loading ? 'var(--border)' : '#238636',
          color: '#fff', fontSize: '.9rem', fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s',
        }}>
          {GH_ICON}
          {loading ? 'Opening GitHub...' : 'Sign in with GitHub'}
        </button>

        {error && (
          <div style={{ marginTop: '1rem', color: '#f85149', fontSize: '.8rem', lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          Requires repo, user, read:org scope
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update src/App.js for routing**

Replace the entire content of `src/App.js` with:

```js
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '.85rem',
      }}>
        Loading...
      </div>
    );
  }

  return user ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

- [ ] **Step 6: Create placeholder DashboardPage so the app compiles**

Create `src/pages/DashboardPage.js` (temporary, replaced in Task 9):

```js
import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: '2rem', color: 'var(--text)' }}>
      <p>Logged in as <b>{user?.login}</b></p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
```

- [ ] **Step 7: Verify app compiles and shows LoginPage**

```bash
npm run dev
```

Expected: Electron opens. LoginPage shows with "Sign in with GitHub" button. Clicking it opens the system browser at GitHub's OAuth page. After authorizing, the app should redirect back (custom protocol) and show "Logged in as [your-login]" on the placeholder dashboard. Sign out resets to LoginPage.

- [ ] **Step 8: Commit**

```bash
git add src/context/ src/pages/ src/App.js
git commit -m "feat: auth routing — LoginPage with GitHub OAuth, AuthContext"
```

---

## Task 6 — GitHub API IPC handlers in main.js

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Add GitHub data IPC handlers to main.js**

Add this block in `electron/main.js` after the `// ── IPC: Auth` section:

```js
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
  const token    = loadToken();
  const { userLogin } = readConfig();
  const login    = userLogin || (await githubGet('/user', token)).login;
  const from     = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const to       = new Date().toISOString();
  const query    = `{
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

  // Validate repo name — GitHub allows [a-z0-9._-]
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error('Invalid repository name. Use only letters, numbers, hyphens, underscores, and dots.');
  }

  const repo = await githubPost('api.github.com', '/user/repos', {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'GitHub-Dashboard-App/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }, { name, description: description || '', private: isPrivate, auto_init: false });

  if (!repo.clone_url) throw new Error(repo.message || 'Failed to create repository');

  // If a local path was provided, initialise git and set remote
  if (localPath && fs.existsSync(localPath)) {
    try {
      execSync('git init', { cwd: localPath, stdio: 'ignore' });
      execSync(`git remote add origin ${repo.clone_url}`, { cwd: localPath, stdio: 'ignore' });
    } catch (err) {
      // Non-fatal — repo is created on GitHub, local git init failed
      console.warn('git init/remote failed:', err.message);
    }
  }

  return { cloneUrl: repo.clone_url, htmlUrl: repo.html_url, name: repo.name };
});
```

- [ ] **Step 2: Verify handlers respond**

```bash
npm run dev
```

After signing in, open DevTools console and run:

```js
window.electronAPI.fetchRepos().then(r => console.log('repos:', r.length))
// Expected: repos: <number>

window.electronAPI.fetchActivity().then(r => console.log('events:', r.length))
// Expected: events: <number>

window.electronAPI.fetchContributions().then(r => console.log('contribs:', JSON.stringify(r).slice(0,100)))
// Expected: JSON with contributionCalendar data
```

- [ ] **Step 3: Commit**

```bash
git add electron/main.js
git commit -m "feat: IPC handlers for repos, activity, contributions, createRepo"
```

---

## Task 7 — Data mapper utilities + useGitHub hook + tests

**Files:**
- Create: `src/hooks/useGitHub.js`

- [ ] **Step 1: Write failing tests for data mappers**

Create `src/hooks/useGitHub.test.js`:

```js
import { mapRepo, mapEvent, relativeTime, mapContributions, mapProfile } from './useGitHub';

// ── relativeTime ──────────────────────────────────────────────────────────────

test('relativeTime: just now for < 2 min', () => {
  const iso = new Date(Date.now() - 60 * 1000).toISOString();
  expect(relativeTime(iso)).toBe('Just now');
});

test('relativeTime: X minutes ago', () => {
  const iso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  expect(relativeTime(iso)).toBe('30 minutes ago');
});

test('relativeTime: Yesterday', () => {
  const iso = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  expect(relativeTime(iso)).toBe('Yesterday');
});

// ── mapRepo ───────────────────────────────────────────────────────────────────

test('mapRepo: maps GitHub repo to component shape', () => {
  const raw = {
    name: 'my-repo',
    description: 'A repo',
    language: 'TypeScript',
    stargazers_count: 42,
    forks_count: 5,
    open_issues_count: 3,
    archived: false,
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    html_url: 'https://github.com/user/my-repo',
  };
  const result = mapRepo(raw);
  expect(result.name).toBe('my-repo');
  expect(result.lang).toBe('TypeScript');
  expect(result.langColor).toBe('#3178c6');
  expect(result.stars).toBe(42);
  expect(result.status).toBe('open');
});

test('mapRepo: archived repo gets status closed', () => {
  const raw = { name: 'old', description: '', language: null, stargazers_count: 0,
    forks_count: 0, open_issues_count: 0, archived: true, updated_at: new Date().toISOString() };
  expect(mapRepo(raw).status).toBe('closed');
});

// ── mapEvent ──────────────────────────────────────────────────────────────────

test('mapEvent: PushEvent returns push type', () => {
  const raw = {
    type: 'PushEvent',
    repo: { name: 'user/repo' },
    payload: { commits: [{}, {}] },
    created_at: new Date().toISOString(),
  };
  const result = mapEvent(raw);
  expect(result.type).toBe('push');
  expect(result.title).toContain('2 commits');
});

test('mapEvent: WatchEvent returns star type', () => {
  const raw = { type: 'WatchEvent', repo: { name: 'user/repo' }, payload: {}, created_at: new Date().toISOString() };
  expect(mapEvent(raw).type).toBe('star');
});

// ── mapContributions ──────────────────────────────────────────────────────────

test('mapContributions: extracts weeks and total', () => {
  const response = {
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 500,
            weeks: [{ contributionDays: [{ contributionCount: 3, date: '2025-01-01' }] }],
          },
        },
      },
    },
  };
  const result = mapContributions(response);
  expect(result.total).toBe(500);
  expect(result.weeks).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
npx react-scripts test --watchAll=false src/hooks/useGitHub.test.js
```

Expected: multiple failures like "Cannot find module './useGitHub'".

- [ ] **Step 3: Create src/hooks/useGitHub.js**

```js
import { useState, useCallback } from 'react';

// ── Language colour map ───────────────────────────────────────────────────────

export const LANG_COLORS = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python:     '#3572A5',
  Go:         '#00ADD8',
  Rust:       '#dea584',
  Java:       '#b07219',
  Ruby:       '#701516',
  'C++':      '#f34b7d',
  C:          '#555555',
  Shell:      '#89e051',
  HTML:       '#e34c26',
  CSS:        '#563d7c',
};

// ── Utilities ─────────────────────────────────────────────────────────────────

export function relativeTime(isoString) {
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins <= 1)   return 'Just now';
  if (mins < 60)   return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days  = Math.floor(hours / 24);
  if (days === 1)  return 'Yesterday';
  if (days < 7)    return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

function ucfirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function mapRepo(r) {
  return {
    name:      r.name,
    desc:      r.description || '',
    lang:      r.language || 'Other',
    langColor: LANG_COLORS[r.language] || '#8b949e',
    stars:     r.stargazers_count,
    forks:     r.forks_count,
    status:    r.archived ? 'closed' : 'open',
    prs:       0,
    issues:    r.open_issues_count,
    updated:   relativeTime(r.updated_at),
    htmlUrl:   r.html_url,
  };
}

export function mapEvent(e) {
  const TYPE_MAP = {
    PushEvent:         { icon: '📝', bg: 'rgba(35,134,54,0.15)',   type: 'push' },
    PullRequestEvent:  { icon: '🔀', bg: 'rgba(137,87,229,0.15)',  type: 'pr' },
    IssuesEvent:       { icon: '🐛', bg: 'rgba(218,54,51,0.15)',   type: 'issue' },
    WatchEvent:        { icon: '⭐', bg: 'rgba(210,153,34,0.15)',  type: 'star' },
    ForkEvent:         { icon: '🍴', bg: 'rgba(88,166,255,0.15)',  type: 'fork' },
    CreateEvent:       { icon: '🏷️', bg: 'rgba(188,140,255,0.15)', type: 'create' },
    IssueCommentEvent: { icon: '💬', bg: 'rgba(88,166,255,0.15)',  type: 'comment' },
    ReleaseEvent:      { icon: '🚀', bg: 'rgba(188,140,255,0.15)', type: 'release' },
  };
  const meta = TYPE_MAP[e.type] || { icon: '⚡', bg: 'rgba(88,166,255,0.15)', type: 'other' };

  let title = '';
  if (e.type === 'PushEvent') {
    const n = e.payload.commits?.length || 0;
    title = `Pushed <b>${n} commit${n !== 1 ? 's' : ''}</b> to <b>${e.repo.name}</b>`;
  } else if (e.type === 'PullRequestEvent') {
    const merged = e.payload.action === 'closed' && e.payload.pull_request?.merged;
    title = `${merged ? 'Merged' : ucfirst(e.payload.action)} PR <b>#${e.payload.pull_request?.number}</b> in <b>${e.repo.name}</b>`;
  } else if (e.type === 'IssuesEvent') {
    title = `${ucfirst(e.payload.action)} issue <b>#${e.payload.issue?.number}</b> in <b>${e.repo.name}</b>`;
  } else if (e.type === 'WatchEvent') {
    title = `Starred <b>${e.repo.name}</b>`;
  } else if (e.type === 'ForkEvent') {
    title = `Forked <b>${e.repo.name}</b>`;
  } else if (e.type === 'CreateEvent') {
    title = `Created ${e.payload.ref_type} <b>${e.payload.ref || e.repo.name}</b>`;
  } else if (e.type === 'IssueCommentEvent') {
    title = `Commented on issue <b>#${e.payload.issue?.number}</b> in <b>${e.repo.name}</b>`;
  } else if (e.type === 'ReleaseEvent') {
    title = `Released <b>${e.payload.release?.tag_name}</b> of <b>${e.repo.name}</b>`;
  } else {
    title = `${e.type} in <b>${e.repo.name}</b>`;
  }

  return { ...meta, title, time: relativeTime(e.created_at) };
}

export function mapContributions(graphqlResponse) {
  const calendar = graphqlResponse?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) return { weeks: [], total: 0 };
  return { weeks: calendar.weeks, total: calendar.totalContributions };
}

export function mapProfile(user, repos, contributionsTotal) {
  const langCounts = {};
  repos.forEach(r => { if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1; });
  const total = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({
      name,
      pct: Math.round((count / total) * 100),
      color: LANG_COLORS[name] || '#8b949e',
    }));

  return {
    name:      user.name || user.login,
    handle:    user.login,
    avatar:    user.avatar_url,
    bio:       user.bio || '',
    location:  user.location || '',
    repos:     user.public_repos,
    followers: user.followers,
    following: user.following,
    commits:   contributionsTotal,
    stars:     repos.reduce((s, r) => s + (r.stargazers_count || 0), 0),
    languages,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGitHubData(user) {
  const [repos,         setRepos]         = useState([]);
  const [activity,      setActivity]      = useState([]);
  const [contributions, setContributions] = useState({ weeks: [], total: 0 });
  const [profile,       setProfile]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [rawRepos, rawActivity, rawContribs] = await Promise.all([
        window.electronAPI.fetchRepos(),
        window.electronAPI.fetchActivity(),
        window.electronAPI.fetchContributions(),
      ]);

      const mappedRepos   = rawRepos.map(mapRepo);
      const mappedEvents  = rawActivity.map(mapEvent);
      const mappedContrib = mapContributions(rawContribs);
      const mappedProfile = mapProfile(user, rawRepos, mappedContrib.total);

      setRepos(mappedRepos);
      setActivity(mappedEvents);
      setContributions(mappedContrib);
      setProfile(mappedProfile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { repos, activity, contributions, profile, loading, error, refresh };
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npx react-scripts test --watchAll=false src/hooks/useGitHub.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: data mappers and useGitHubData hook with tests"
```

---

## Task 8 — Update components to accept live data props

**Files:**
- Modify: `src/components/ProfileCard.js`
- Modify: `src/components/ContributionGrid.js`
- Modify: `src/components/ActivityFeed.js`

- [ ] **Step 1: Update ProfileCard.js to accept props**

Replace the entire content of `src/components/ProfileCard.js` with:

```js
import React from 'react';

export default function ProfileCard({ profile }) {
  if (!profile) return null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', transition: 'border-color .3s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'start' }}>

        {/* Avatar */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border)' }}>
          {profile.avatar?.startsWith('http') ? (
            <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#bc8cff,#58a6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
              {profile.avatar || '👤'}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '.15rem' }}>{profile.name}</div>
          <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '.82rem', marginBottom: '.55rem' }}>@{profile.handle}</div>
          <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: '.7rem', lineHeight: 1.5 }}>{profile.bio}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {profile.location && (
              <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: '.7rem', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', color: '#58a6ff' }}>
                🌍 {profile.location}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
            {[
              { val: profile.repos,                    label: 'Repos' },
              { val: profile.followers?.toLocaleString(), label: 'Followers' },
              { val: profile.commits?.toLocaleString(),   label: 'Commits' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', padding: '.75rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '.1rem' }}>{s.val}</div>
                <div style={{ fontSize: '.66rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Language bar */}
          {profile.languages?.length > 0 && (
            <>
              <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginBottom: '.35rem' }}>Top Languages</div>
              <div style={{ display: 'flex', height: 6, borderRadius: 100, overflow: 'hidden', gap: 1 }}>
                {profile.languages.map(l => <div key={l.name} style={{ flex: l.pct, background: l.color }} title={`${l.name}: ${l.pct}%`} />)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: '.4rem', flexWrap: 'wrap' }}>
                {profile.languages.map(l => (
                  <span key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '.65rem', color: 'var(--muted)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, display: 'inline-block' }} />{l.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update ContributionGrid.js to accept weeks + total props**

Replace the entire content of `src/components/ContributionGrid.js` with:

```js
import React, { useEffect, useState } from 'react';

const LEVELS  = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const MONTHS  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEIGHTS = [35, 22, 16, 14, 13];

function weightedRandom(seed) {
  let h = (seed * 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const r = h % 100;
  let c = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    c += WEIGHTS[i];
    if (r < c) return i;
  }
  return 0;
}

function countToLevel(n) {
  if (n === 0) return 0;
  if (n <= 3)  return 1;
  if (n <= 6)  return 2;
  if (n <= 12) return 3;
  return 4;
}

export default function ContributionGrid({ weeks = [], total = 0 }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      setRevealed(i);
      if (i >= 364) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const cells = weeks.length > 0
    ? weeks.flatMap(w => w.contributionDays).map((d, i) => ({
        level: countToLevel(d.contributionCount),
        count: d.contributionCount,
        date:  d.date,
        idx:   i,
      }))
    : Array.from({ length: 364 }, (_, i) => ({
        level: weightedRandom(i * 31 + 7),
        count: 0,
        date:  '',
        idx:   i,
      }));

  const displayTotal = total > 0 ? total : cells.reduce((s, c) => s + c.level * 3, 0);
  const year         = weeks.length > 0
    ? new Date(weeks[0]?.contributionDays[0]?.date).getFullYear()
    : new Date().getFullYear();

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
        <div style={{ fontSize: '.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
          Contribution Activity — {year}
        </div>
        <div style={{ fontSize: '.75rem', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
          {displayTotal.toLocaleString()} contributions
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', marginBottom: '.35rem' }}>
        {MONTHS.map(m => (
          <span key={m} style={{ fontSize: '.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{m}</span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(52, 1fr)', gap: 2 }}>
        {cells.map((c, i) => (
          <div key={i}
            title={c.date ? `${c.date}: ${c.count} contributions` : `${c.level * 3} contributions`}
            style={{
              aspectRatio: '1', borderRadius: 2,
              background: i <= revealed ? LEVELS[c.level] : LEVELS[0],
              transition: 'background .3s', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.outline = '1px solid var(--text)'; e.currentTarget.style.outlineOffset = '1px'; }}
            onMouseLeave={e => { e.currentTarget.style.outline = 'none'; }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '.6rem', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>Less</span>
        {LEVELS.map((l, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: l, border: i === 0 ? '1px solid var(--border)' : 'none' }} />
        ))}
        <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>More</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update ActivityFeed.js to accept events prop**

Replace the entire content of `src/components/ActivityFeed.js` with:

```js
import React from 'react';

export default function ActivityFeed({ events = [] }) {
  if (events.length === 0) {
    return (
      <div>
        <div style={{ fontSize: '.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, marginBottom: '.75rem' }}>Recent Activity</div>
        <div style={{ color: 'var(--muted)', fontSize: '.82rem', textAlign: 'center', padding: '2rem 0' }}>No recent activity</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: '.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, marginBottom: '.75rem' }}>Recent Activity</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {events.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.65rem 0', borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
              {a.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.82rem', lineHeight: 1.4 }}
                dangerouslySetInnerHTML={{ __html: a.title.replace(/<b>/g, '<span style="color:var(--blue)">').replace(/<\/b>/g, '</span>') }}
              />
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.15rem', fontFamily: 'var(--font-mono)' }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ProfileCard.js src/components/ContributionGrid.js src/components/ActivityFeed.js
git commit -m "refactor: components accept live data props, remove data.js imports"
```

---

## Task 9 — DashboardPage with live data + loading skeletons + refresh

**Files:**
- Create: `src/pages/DashboardPage.js` (replacing placeholder)
- Delete: `src/data.js`

- [ ] **Step 1: Create full DashboardPage.js**

Replace `src/pages/DashboardPage.js` with:

```js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGitHubData } from '../hooks/useGitHub';
import ProfileCard from '../components/ProfileCard';
import ContributionGrid from '../components/ContributionGrid';
import RepoCard from '../components/RepoCard';
import ActivityFeed from '../components/ActivityFeed';

const GH_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const FILTERS = ['All', 'TypeScript', 'Python', 'JavaScript'];

function Skeleton({ width = '100%', height = 16, radius = 4, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

export default function DashboardPage() {
  const { user, logout }                                        = useAuth();
  const { repos, activity, contributions, profile, loading, error, refresh } = useGitHubData(user);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('All');
  const [detectedFolder, setDetectedFolder] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showWatchDir, setShowWatchDir]     = useState(false);
  const [toast, setToast]                   = useState(null);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    window.electronAPI.getWatchDir().then(dir => {
      if (!dir) setShowWatchDir(true);
    });
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.onFolderDetected(data => setDetectedFolder(data));
    return cleanup;
  }, []);

  const handleRepoCreated = useCallback(({ name, htmlUrl }) => {
    setDetectedFolder(null);
    setShowNewProject(false);
    setToast({ message: `✅ Created github.com/${user.login}/${name}`, type: 'success' });
    refresh();
  }, [refresh, user]);

  const handleSkip = useCallback(async () => {
    if (detectedFolder) await window.electronAPI.skipFolder(detectedFolder.folderPath);
    setDetectedFolder(null);
  }, [detectedFolder]);

  const visible = repos.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
                        r.desc.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || r.lang === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem', minHeight: '100vh' }}>

      {/* Shimmer animation */}
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '1.1rem' }}>
          {GH_ICON} GitHub Dashboard
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px' }}>
            <svg width="13" height="13" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input placeholder="Search repos…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '.8rem', width: 160 }} />
          </div>
          {/* New Project */}
          <button onClick={() => setShowNewProject(true)} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: '#238636', color: '#fff', cursor: 'pointer',
            fontSize: '.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            + New Project
          </button>
          {/* Refresh */}
          <button onClick={refresh} disabled={loading} title="Refresh" style={{
            padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--muted)', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '.85rem',
          }}>
            {loading ? '⏳' : '🔄'}
          </button>
          {/* Avatar */}
          <div onClick={logout} title="Sign out" style={{
            width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
            cursor: 'pointer', border: '2px solid var(--border)',
          }}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user.login} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#bc8cff,#58a6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.75rem' }}>{user?.login?.[0]?.toUpperCase()}</div>
            }
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(218,54,51,0.1)', border: '1px solid #da3633', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: '.82rem', color: '#f85149' }}>
          ⚠️ {error}
        </div>
      )}

      {/* PROFILE */}
      {loading && !profile
        ? <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <Skeleton height={72} width={72} radius={50} style={{ display: 'inline-block' }} />
          </div>
        : <ProfileCard profile={profile} />
      }

      {/* CONTRIBUTION GRID */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ContributionGrid weeks={contributions.weeks} total={contributions.total} />
      </div>

      {/* REPOS + ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
              Repositories ({visible.length})
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '4px 10px', borderRadius: 100, fontSize: '.68rem', cursor: 'pointer',
                  border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
                  background: filter === f ? 'var(--border2)' : 'transparent',
                  color: filter === f ? 'var(--text)' : 'var(--muted)', transition: 'all .2s',
                }}>{f}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            {loading && repos.length === 0
              ? [1,2,3].map(i => <Skeleton key={i} height={80} radius={10} />)
              : visible.length > 0
                ? visible.map(r => <RepoCard key={r.name} repo={r} />)
                : <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>No repos match your search.</div>
            }
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
          {loading && activity.length === 0
            ? <>{[1,2,3,4].map(i => <Skeleton key={i} height={40} radius={6} style={{ marginBottom: 8 }} />)}</>
            : <ActivityFeed events={activity} />
          }
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>GitHub Dashboard v1.0.0</div>
        <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>api.github.com · {user?.login}</div>
      </div>

      {/* MODALS — added in Task 10–13 */}
      {(detectedFolder || showNewProject) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', width: 400 }}>
            <p style={{ color: 'var(--text)' }}>CreateRepoModal coming in Task 12</p>
            <button onClick={() => { setDetectedFolder(null); setShowNewProject(false); }}>Close</button>
          </div>
        </div>
      )}
      {showWatchDir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', width: 400, textAlign: 'center' }}>
            <p style={{ color: 'var(--text)' }}>WatchDirModal coming in Task 10</p>
            <button onClick={() => setShowWatchDir(false)}>Skip</button>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: '#238636', color: '#fff', padding: '12px 16px', borderRadius: 8, fontSize: '.85rem', cursor: 'pointer', zIndex: 2000 }}
          onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete src/data.js**

```bash
rm src/data.js
```

- [ ] **Step 3: Verify full dashboard loads with live data**

```bash
npm run dev
```

Expected: sign in → dashboard shows live profile, real repos, real activity feed, real contribution grid. Refresh button re-fetches. Sign-out avatar click returns to LoginPage.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.js
git rm src/data.js
git commit -m "feat: full dashboard with live GitHub data, loading skeletons, refresh"
```

---

## Task 10 — Config persistence + WatchDirModal + watcher IPC handlers

**Files:**
- Modify: `electron/main.js`
- Create: `src/components/WatchDirModal.js`
- Modify: `src/pages/DashboardPage.js`

- [ ] **Step 1: Add watcher IPC handlers to main.js**

Add this block to `electron/main.js` after the GitHub data IPC section:

```js
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
```

- [ ] **Step 2: Create src/components/WatchDirModal.js**

```js
import React, { useState } from 'react';

export default function WatchDirModal({ onSelect, onDismiss }) {
  const [loading, setLoading] = useState(false);

  const handlePick = async () => {
    setLoading(true);
    const dir = await window.electronAPI.pickWatchDir();
    setLoading(false);
    if (dir) onSelect(dir);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', width: 420, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📂</div>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.5rem' }}>Set your projects folder</div>
        <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          GitHub Dashboard will watch this folder for new projects and offer to create a GitHub repository automatically.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onDismiss} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem' }}>
            Skip for now
          </button>
          <button onClick={handlePick} disabled={loading} style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: loading ? 'var(--border)' : '#238636',
            color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '.85rem', fontWeight: 600,
          }}>
            {loading ? 'Selecting...' : 'Choose folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire WatchDirModal into DashboardPage.js**

In `src/pages/DashboardPage.js`, add the import at the top:

```js
import WatchDirModal from '../components/WatchDirModal';
```

Replace the `{showWatchDir && ...}` placeholder block with:

```js
{showWatchDir && (
  <WatchDirModal
    onSelect={() => setShowWatchDir(false)}
    onDismiss={() => setShowWatchDir(false)}
  />
)}
```

- [ ] **Step 4: Verify WatchDirModal appears on first launch**

```bash
npm run dev
```

Expected: after sign-in, WatchDirModal appears (if no watch dir is set). Pick a folder — modal closes. Relaunch the app — modal no longer appears.

- [ ] **Step 5: Commit**

```bash
git add electron/main.js src/components/WatchDirModal.js src/pages/DashboardPage.js
git commit -m "feat: watched dir config, WatchDirModal, watcher IPC handlers"
```

---

## Task 11 — chokidar file watcher in main.js

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Replace the startWatcher stub in main.js**

Find the `function startWatcher(watchDir) { // Implemented in Task 11 }` stub and replace it with:

```js
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
    const folderName = require('path').basename(folderPath);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('folder-detected', { folderName, folderPath });
    }
  });

  watcher.on('error', (err) => {
    console.error('Watcher error:', err.message);
  });
}
```

- [ ] **Step 2: Verify watcher fires folder-detected**

```bash
npm run dev
```

Pick the watch dir (e.g. `C:\Users\you\test-projects`). Open the folder in Explorer and create a new folder inside it. Expected: a placeholder modal appears in the app within 1-2 seconds. Close app.

- [ ] **Step 3: Commit**

```bash
git add electron/main.js
git commit -m "feat: chokidar watcher fires folder-detected IPC on new directory"
```

---

## Task 12 — CreateRepoModal + createRepo wired end-to-end

**Files:**
- Create: `src/components/CreateRepoModal.js`
- Modify: `src/pages/DashboardPage.js`

- [ ] **Step 1: Create src/components/CreateRepoModal.js**

```js
import React, { useState } from 'react';

export default function CreateRepoModal({ folderName = '', folderPath = null, onConfirm, onSkip }) {
  const [name,      setName]      = useState(folderName);
  const [desc,      setDesc]      = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const sanitize = (v) => v.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^[-.]/, '');

  const handleCreate = async () => {
    const repoName = name.trim();
    if (!repoName) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.createRepo({
        name: repoName,
        description: desc.trim(),
        isPrivate,
        localPath: folderPath,
      });
      onConfirm(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', width: 420, maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: folderPath ? '.4rem' : '1rem' }}>
          {folderPath ? '📁 New folder detected' : '✨ New Project'}
        </div>

        {folderPath && (
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '1rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
            {folderPath}
          </div>
        )}

        {/* Repo name */}
        <label style={{ fontSize: '.75rem', color: 'var(--muted)', display: 'block', marginBottom: '.3rem' }}>Repository name</label>
        <input
          value={name}
          onChange={e => setName(sanitize(e.target.value))}
          placeholder="my-project"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: '.85rem', boxSizing: 'border-box', marginBottom: '.75rem', outline: 'none' }}
        />

        {/* Description */}
        <label style={{ fontSize: '.75rem', color: 'var(--muted)', display: 'block', marginBottom: '.3rem' }}>Description <span style={{ opacity: .5 }}>(optional)</span></label>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Short description…"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: '.85rem', boxSizing: 'border-box', marginBottom: '.75rem', outline: 'none' }}
        />

        {/* Visibility */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {['Private', 'Public'].map(v => {
            const active = (v === 'Private') === isPrivate;
            return (
              <button key={v} onClick={() => setIsPrivate(v === 'Private')} style={{
                flex: 1, padding: '8px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                background: active ? 'var(--border2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--muted)', fontSize: '.82rem',
              }}>
                {v === 'Private' ? '🔒' : '🌐'} {v}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ color: '#f85149', fontSize: '.78rem', marginBottom: '.75rem', lineHeight: 1.4 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onSkip} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem' }}>
            Skip
          </button>
          <button onClick={handleCreate} disabled={loading || !name.trim()} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none',
            background: loading || !name.trim() ? 'var(--border)' : '#238636',
            color: '#fff', cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
            fontSize: '.85rem', fontWeight: 600, transition: 'background .2s',
          }}>
            {loading ? 'Creating…' : 'Create Repo'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire CreateRepoModal into DashboardPage.js**

Add import at the top of `src/pages/DashboardPage.js`:

```js
import CreateRepoModal from '../components/CreateRepoModal';
```

Replace the `{(detectedFolder || showNewProject) && ...}` placeholder block with:

```js
{(detectedFolder || showNewProject) && (
  <CreateRepoModal
    folderName={detectedFolder?.folderName || ''}
    folderPath={detectedFolder?.folderPath || null}
    onConfirm={handleRepoCreated}
    onSkip={handleSkip}
  />
)}
```

- [ ] **Step 3: Verify end-to-end repo creation flow**

```bash
npm run dev
```

Test A — Detected folder:
1. Create a new folder in your watched directory
2. Modal appears with folder name pre-filled
3. Keep default (Private), click "Create Repo"
4. Expected: repo appears on `github.com/{you}/{folder-name}`, local folder has `.git` with remote set

Test B — New Project button:
1. Click "+ New Project" in top bar
2. Type a repo name, set to Public
3. Click "Create Repo"
4. Expected: repo created on GitHub, new folder created in watched dir, refresh shows new repo

- [ ] **Step 4: Commit**

```bash
git add src/components/CreateRepoModal.js src/pages/DashboardPage.js
git commit -m "feat: CreateRepoModal — detected folder and new project flows"
```

---

## Task 13 — Toast notifications + final DashboardPage polish

**Files:**
- Create: `src/components/Toast.js`
- Modify: `src/pages/DashboardPage.js`

- [ ] **Step 1: Create src/components/Toast.js**

```js
import React, { useEffect } from 'react';

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem',
        background: type === 'success' ? '#238636' : '#da3633',
        color: '#fff', padding: '12px 16px', borderRadius: 8,
        fontSize: '.85rem', maxWidth: 340, lineHeight: 1.4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 2000, cursor: 'pointer',
        animation: 'slideIn .2s ease-out',
      }}
    >
      <style>{`@keyframes slideIn { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }`}</style>
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Wire Toast into DashboardPage.js**

Add import:

```js
import Toast from '../components/Toast';
```

Replace the inline toast placeholder at the bottom of the JSX with:

```js
{toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
```

- [ ] **Step 3: Update handleRepoCreated to use proper toast**

The `handleRepoCreated` function in `DashboardPage.js` already sets toast state. Verify its current form is:

```js
const handleRepoCreated = useCallback(({ name, htmlUrl }) => {
  setDetectedFolder(null);
  setShowNewProject(false);
  setToast({ message: `✅ Created github.com/${user.login}/${name}`, type: 'success' });
  refresh();
}, [refresh, user]);
```

If it's different, update it to match the above.

- [ ] **Step 4: Verify toast appears and auto-dismisses**

```bash
npm run dev
```

Create a repo via "New Project". Expected: green toast appears in bottom-right, shows `✅ Created github.com/{login}/{name}`. Auto-dismisses after 4 seconds. Clicking it dismisses immediately.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toast.js src/pages/DashboardPage.js
git commit -m "feat: Toast notifications for repo creation success/error"
```

---

## Task 14 — electron-builder config + icon + .exe build

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json` (verify dist script)

- [ ] **Step 1: Create a placeholder icon**

The build requires `public/icon.ico`. Create one by downloading any 256×256 PNG and converting it to `.ico` using an online tool (e.g. `convertico.com`), then save as `public/icon.ico`.

If you want to skip this temporarily, copy any `.ico` file and rename it. The build will work without a custom icon if you remove the `icon` line from `electron-builder.yml`.

- [ ] **Step 2: Create electron-builder.yml**

Create `electron-builder.yml` at the project root:

```yaml
appId: com.abhishek.github-dashboard
productName: GitHub Dashboard
copyright: Copyright © 2026 Abhishek

directories:
  output: dist

files:
  - build/**/*
  - electron/**/*
  - node_modules/**/*
  - package.json

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: public/icon.ico
  protocols:
    - name: GitHub Dashboard
      schemes:
        - github-dashboard

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: GitHub Dashboard

extraMetadata:
  main: electron/main.js
```

- [ ] **Step 3: Verify package.json dist script**

Confirm `package.json` has these scripts (they should already be set from Task 1):

```json
"dist": "react-scripts build && electron-builder --win"
```

If it says just `electron-builder`, update it to `react-scripts build && electron-builder --win`.

- [ ] **Step 4: Set environment variables for production build**

Before building, ensure `.env` has real values. Then run:

```bash
npm run dist
```

Expected output (takes 3-5 minutes):
```
• electron-builder  version=24.x
• loaded configuration  file=electron-builder.yml
• packaging       platform=win32 arch=x64 electron=29.x
• building        target=nsis file=dist\GitHub Dashboard Setup 1.0.0.exe
• building block map
```

Final output: `dist\GitHub Dashboard Setup 1.0.0.exe`

- [ ] **Step 5: Install and verify the exe**

1. Double-click `dist\GitHub Dashboard Setup 1.0.0.exe`
2. Complete the installer — creates Start Menu shortcut and Desktop shortcut
3. Launch from Start Menu
4. Expected: app opens, LoginPage shown, OAuth flow works (custom protocol `github-dashboard://` is registered by the installer), dashboard loads live data, file watcher works

- [ ] **Step 6: Final commit**

```bash
git add electron-builder.yml public/icon.ico
git commit -m "feat: electron-builder NSIS config — produces GitHub Dashboard Setup.exe"
```

---

## Security Checklist

Before shipping, verify these are all in place:

- [ ] `nodeIntegration: false` in BrowserWindow — confirmed in Task 2
- [ ] `contextIsolation: true` in BrowserWindow — confirmed in Task 2
- [ ] `sandbox: true` in BrowserWindow — confirmed in Task 2  
- [ ] `webSecurity: true`, `allowRunningInsecureContent: false` — confirmed in Task 2
- [ ] CSP headers set via `session.defaultSession.webRequest.onHeadersReceived` — Task 2
- [ ] GitHub token stored via `safeStorage` (DPAPI) — Task 2, never reaches renderer
- [ ] `GITHUB_CLIENT_SECRET` only read in main process, never sent to renderer — Task 4
- [ ] Repo name sanitized server-side before GitHub API call — Task 6
- [ ] `shell.openExternal` only called with a hardcoded GitHub URL — Task 4
- [ ] Single-instance lock prevents second-instance attacks — Task 4
- [ ] `.env` in `.gitignore` — Task 3

---

## Self-review notes

- All spec sections covered: OAuth ✓, live data ✓, folder detection ✓, new-project flow ✓, NSIS packaging ✓, security model ✓
- Type consistency: `mapRepo` returns `{ name, desc, lang, langColor, stars, forks, status, prs, issues, updated, htmlUrl }` — matches RepoCard's usage throughout
- `createRepo` IPC signature `{ name, description, isPrivate, localPath }` matches CreateRepoModal's `window.electronAPI.createRepo(opts)` call
- `onFolderDetected` returns a cleanup function in preload.js — DashboardPage calls `return cleanup` in useEffect ✓
