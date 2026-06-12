# Dev Dashboard

> **Author:** Abhishek K  
> **Version:** 1.0.2  
> **Platform:** Windows 10/11 x64

A desktop app that connects to your real GitHub account — view your repos, contribution graph, and activity feed, and automatically create GitHub repositories when you add a new project folder locally.

---

## Download

**[Dev Dashboard Setup 1.0.1.exe](https://github.com/abhi-30702/Github_integration/releases/tag/v1.0.1)**

1. Download and run the installer
2. If Windows shows a SmartScreen warning, click **More info → Run anyway**
3. Sign in with GitHub when the app opens

---

## Features

- **GitHub OAuth login** — sign in with your own GitHub account, no personal access token needed
- **Repositories** — live search and filter by language (TypeScript, Python, JavaScript)
- **Contribution graph** — 52-week contribution calendar pulled from GitHub GraphQL API
- **Activity feed** — pushes, PRs, issues, stars, forks, and releases in real time
- **Profile card** — avatar, bio, follower stats, and language distribution
- **Folder watcher** — set a local projects folder; when you create a new subfolder, the app offers to create a matching GitHub repository automatically
- **New Project button** — manually trigger repo creation from inside the app
- **Repo creation modal** — set name, description, and public/private before creating

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 (Create React App) |
| Desktop shell | Electron 29 |
| Auth | GitHub OAuth (custom URL protocol) |
| Token storage | Electron `safeStorage` (DPAPI on Windows) |
| GitHub API | REST + GraphQL via native `https` |
| File watching | chokidar v3 |
| Installer | electron-builder NSIS |

---

## Developer Setup

### Prerequisites
- Node.js 18+
- A GitHub OAuth App ([create one here](https://github.com/settings/developers))

### OAuth App Settings
| Field | Value |
|---|---|
| Homepage URL | `https://github.com/abhi-30702/Github_integration` |
| Authorization callback URL | `github-dashboard://oauth/callback` |

### Install & Run (dev mode)

```bash
git clone https://github.com/abhi-30702/Github_integration.git
cd Github_integration
npm install
```

Create a `.env` file in the project root:

```
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

Start the app in development mode (React + Electron together):

```bash
npm run dev
```

### Build Installer

```bash
npm run dist
```

Output: `dist/Dev Dashboard Setup 1.0.1.exe`

---

## Project Structure

```
github-integration/
├── electron/
│   ├── main.js          # Electron main process — OAuth, GitHub API, file watcher, IPC
│   └── preload.js       # contextBridge — secure API exposed to renderer
├── src/
│   ├── context/
│   │   └── AuthContext.js       # Auth state (login/logout)
│   ├── hooks/
│   │   └── useGitHub.js         # Data fetching + mappers for repos, activity, contributions
│   ├── components/
│   │   ├── ProfileCard.js
│   │   ├── ContributionGrid.js
│   │   ├── RepoCard.js
│   │   ├── ActivityFeed.js
│   │   ├── CreateRepoModal.js
│   │   ├── WatchDirModal.js
│   │   └── Toast.js
│   ├── pages/
│   │   ├── LoginPage.js
│   │   └── DashboardPage.js
│   └── App.js
├── .env                 # OAuth credentials (not committed)
├── electron-builder.yml
└── package.json
```

---

## Security

- `nodeIntegration` is disabled — the renderer has no direct Node.js access
- All GitHub API calls and token handling happen in the main process
- OAuth tokens are encrypted with Windows DPAPI via Electron `safeStorage`
- Content Security Policy headers are applied to all renderer requests

---

## Author

**Abhishek K** · Built with Electron + React 18 · 2026
