# GitHub Integration Dashboard

> **Author:** Abhishek K
> **Version:** 1.0.0

---

## Overview

**GitHub Integration Dashboard** is a full-featured GitHub profile and repository viewer — built with React and styled with GitHub's native dark aesthetic. It displays your contribution activity, repositories, language stats, and a live activity feed — all in one place, with live search and language filtering.

This is the GitHub profile page you wish GitHub actually had.

---

## Features

### Profile
- **Profile card** with avatar, bio, location chips, tech stack badges
- **Language distribution bar** — proportional language breakdown
- **Key stats** — repos, followers, total commits (one glance)

### Contribution Grid
- **364-cell animated grid** — cells reveal progressively on page load (staggered animation)
- **5-level color scale** — GitHub-native green depth shading
- **Month labels** — Jan through Dec across the top
- **Hover tooltips** — contribution count per day
- **Deterministic rendering** — consistent grid on each render

### Repositories
- **Live search** — filter repos by name or description in real time
- **Language filter tabs** — All / TypeScript / Python / JavaScript
- **Repo cards** with: language dot, star count, fork count, PR badge, status badge (Open/Merged/Closed)
- **Hover slide** — cards slide right on hover

### Activity Feed
- Chronological activity: pushes, PRs, issues, stars, forks, releases
- Color-coded by action type
- JetBrains Mono timestamps

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Cabinet Grotesk | Display font |
| JetBrains Mono | Monospace / code font |
| CSS Variables | GitHub-native dark theming |

> No chart libraries needed — the contribution grid is pure CSS Grid + JS.

---

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Install & Run

```bash
cd github-integration
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
```

---

## Project Structure

```
github-integration/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── ProfileCard.js          # Profile with language bar + stats
│   │   ├── ContributionGrid.js     # 364-cell animated contribution graph
│   │   ├── RepoCard.js             # Repo with stats, badges, hover effect
│   │   └── ActivityFeed.js         # Chronological activity list
│   ├── data.js                     # Profile, repos, activity mock data
│   ├── App.js                      # Root with search + language filter
│   ├── index.js                    # Entry point
│   └── index.css                   # Global styles + CSS variables
└── package.json
```

---

## Mock Data

All mock data is in `src/data.js`. Edit to match your profile:

```js
export const PROFILE = {
  name: 'Abhishek K',
  handle: 'abhishek-dev',
  avatar: '🦁',
  bio: 'Full-stack engineer · Fintech · Building EduCIBIL & AI-powered products',
  location: 'Bengaluru, India',
  repos: 47,
  followers: 892,
  commits: 1247,
};

export const REPOS = [
  {
    name: 'educibil',
    desc: 'Credit bureau model for education financing',
    lang: 'TypeScript',
    langColor: '#3178c6',
    stars: 124,
    forks: 18,
    status: 'open',
    prs: 3,
  },
  // Add more repos...
];
```

---

## Connecting to Real GitHub API

Replace mock data with live GitHub API calls:

```js
// Fetch profile
const profile = await fetch('https://api.github.com/users/YOUR_USERNAME', {
  headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
}).then(r => r.json());

// Fetch repos
const repos = await fetch('https://api.github.com/users/YOUR_USERNAME/repos?sort=stars&per_page=20', {
  headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
}).then(r => r.json());

// Fetch contribution data (requires GraphQL API)
const contributions = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
  body: JSON.stringify({
    query: `{ user(login: "YOUR_USERNAME") { contributionsCollection { contributionCalendar { weeks { contributionDays { contributionCount date } } } } } }`
  })
}).then(r => r.json());
```

> GitHub personal access tokens: [github.com/settings/tokens](https://github.com/settings/tokens)

---

## Design System

| Token | Value |
|---|---|
| Background | `#0d1117` |
| Surface | `#161b22` |
| Surface 2 | `#21262d` |
| Border | `#30363d` |
| Text | `#e6edf3` |
| Green (contributions) | `#39d353` |
| Blue (links) | `#58a6ff` |
| Purple (PRs) | `#bc8cff` |
| Font Display | Cabinet Grotesk |
| Font Mono | JetBrains Mono |

---

## Author

**Abhishek K** · Built with React 18 · 2025
