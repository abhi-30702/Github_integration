# GitHub Dashboard Desktop App — Design Spec
**Date:** 2026-06-12  
**Status:** Approved  

---

## Overview

Convert the existing React GitHub Dashboard (CRA, mock data) into a production-quality Windows desktop application packaged as an `.exe` installer. The app authenticates with GitHub via OAuth, displays live profile/repo/activity data, and watches a local directory to automatically create GitHub repos when new project folders are detected.

---

## Architecture

### Process Split

```
github-integration/
├── electron/
│   ├── main.js          # Electron main process — OAuth, file watching, IPC handlers
│   └── preload.js       # contextBridge — exposes typed safe APIs to renderer
├── src/                 # Existing React app (renderer process)
│   ├── components/      # UI components (updated to consume live data)
│   ├── context/
│   │   └── AuthContext.js    # GitHub auth state, token management
│   ├── hooks/
│   │   └── useGitHub.js      # API fetch hooks
│   ├── pages/
│   │   ├── LoginPage.js      # OAuth sign-in screen
│   │   └── DashboardPage.js  # Main dashboard (current App.js content)
│   ├── App.js           # Route between LoginPage / DashboardPage
│   ├── data.js          # Removed — replaced by live API
│   └── index.css
├── package.json         # Updated with Electron + electron-builder deps
└── electron-builder.yml # Build/installer config
```

### Security Model

- `nodeIntegration: false` (default, secure)
- `contextIsolation: true` (enforced)
- `preload.js` exposes only a typed `window.electronAPI` object to React via `contextBridge`
- GitHub token never touches the renderer — stored in Windows Credential Manager via `keytar`
- Client secret lives only in main process environment, never sent to renderer

---

## GitHub OAuth Flow

**Protocol:** Custom URL scheme `github-dashboard://` registered with Windows via `electron-builder` protocol config and `app.setAsDefaultProtocolClient`.

**Step-by-step:**

1. React calls `window.electronAPI.startOAuth()`
2. Main process opens system browser: `https://github.com/login/oauth/authorize?client_id=<ID>&redirect_uri=github-dashboard://callback&scope=repo,user,read:org`
3. User authorizes on GitHub
4. GitHub redirects to `github-dashboard://callback?code=<code>`
5. Windows delivers URL to Electron via second-instance args; main process parses `code` from the URL
6. Main process exchanges `code` for access token directly via `https.request` to `https://github.com/login/oauth/access_token` (client secret lives only in main process, never exposed to renderer)
7. Access token stored in Windows Credential Manager: service=`github-dashboard`, account=`oauth-token`
8. Main process fetches `GET /user` with the token, sends `{ user }` (not the token) to renderer via IPC
9. React `AuthContext` stores user object in state; token is never passed to or held by the renderer

**On relaunch:** main process reads token from keychain silently, fetches `/user`, sends user to renderer — no re-login.

**Sign out:** clears keychain entry, resets React auth state, shows LoginPage.

---

## File Watcher + Repo Creation

### Setup

- On first launch (post-login), a **watched directory picker** modal appears
- User selects a root folder (e.g. `C:\Users\you\Projects`) via `dialog.showOpenDialog`
- Path saved to `electron-store` (persisted across launches)

### Detection Flow (Option A)

1. `chokidar.watch(watchedDir, { depth: 0, ignoreInitial: true })` watches for `addDir` events
2. New top-level folder detected → main process sends `folder-detected` IPC event to renderer with `{ folderName, folderPath }`
3. React shows a **CreateRepoModal** with:
   - Repo name (pre-filled from folder name, editable)
   - Description (optional text input)
   - Visibility toggle: Public / Private (defaults to Private)
   - "Create Repo" button + "Skip" button
4. On "Create Repo":
   - `@octokit/rest`: `POST /user/repos` with name, description, private flag
   - `git init` run in the folder via `child_process.execSync`
   - `git remote add origin <clone_url>` run in the folder
   - Success toast notification shown
5. On "Skip": modal dismissed, folder path added to `skippedFolders` list in `electron-store` — no further prompts for that folder across launches

### New Project Flow (Option C)

1. "New Project" button in the dashboard top bar
2. Same **CreateRepoModal** appears, with empty name field
3. On "Create Repo":
   - GitHub repo created via API
   - Local folder created at `path.join(watchedDir, repoName)` via `fs.mkdirSync`
   - `git init` + `git remote add origin` run in new folder
   - Success toast shown

---

## Live Data — GitHub API

All mock data in `data.js` replaced with real API calls using `@octokit/rest`.

| Data | Endpoint |
|------|----------|
| Profile | `GET /user` |
| Repos | `GET /user/repos?sort=updated&per_page=30` |
| Activity feed | `GET /users/{login}/events?per_page=20` |
| Contribution grid | GitHub GraphQL: `contributionCalendar` |
| Language stats | Derived from repos `language` field |

**Fetching strategy:**
- All data fetched once on login
- Stored in React state via `AuthContext` / `useGitHub` hooks
- Refresh button in top bar re-fetches all data
- Loading skeletons shown during fetch

**IPC bridge API exposed via `preload.js`:**
```js
window.electronAPI = {
  startOAuth: ()        => ipcRenderer.invoke('oauth:start'),
  signOut: ()           => ipcRenderer.invoke('oauth:signout'),
  fetchUser: ()         => ipcRenderer.invoke('github:fetch-user'),
  fetchRepos: ()        => ipcRenderer.invoke('github:fetch-repos'),
  fetchActivity: ()     => ipcRenderer.invoke('github:fetch-activity'),
  fetchContributions:() => ipcRenderer.invoke('github:fetch-contributions'),
  pickWatchDir: ()      => ipcRenderer.invoke('watcher:pick-dir'),
  createRepo: (opts)    => ipcRenderer.invoke('github:create-repo', opts),
  onFolderDetected: (cb)=> ipcRenderer.on('folder-detected', (_, data) => cb(data)),
}
```

---

## Packaging — .exe Installer

**Tool:** `electron-builder` with NSIS target (Windows installer).

**`electron-builder.yml`:**
```yaml
appId: com.abhishek.github-dashboard
productName: GitHub Dashboard
directories:
  output: dist
win:
  target: nsis
  icon: public/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
protocols:
  - name: GitHub Dashboard
    schemes:
      - github-dashboard
```

**Build command:** `npm run build && electron-builder --win`  
**Output:** `dist/GitHub Dashboard Setup 1.0.0.exe` — proper installer with Start Menu entry and uninstaller.

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "electron": "^29.0.0",
    "electron-builder": "^24.0.0",
    "concurrently": "^8.0.0",
    "wait-on": "^7.0.0"
  },
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "chokidar": "^3.6.0",
    "electron-store": "^8.1.0",
    "keytar": "^7.9.0"
  }
}
```

---

## Error Handling

- OAuth failure (user cancels, network error): show error toast, stay on LoginPage
- GitHub API rate limit: catch 403/429, show "Rate limited — try again in X minutes"
- Folder watcher error: log to `electron-log`, show non-blocking warning in UI
- Repo creation failure (name taken, auth error): show inline error in CreateRepoModal, keep modal open

---

## Out of Scope

- Auto-update (`electron-updater`) — can be added post-v1
- macOS/Linux builds — Windows `.exe` only for now
- Push/pull/commit operations — repo creation only, no full Git client
- Multi-account support — single GitHub account per install
