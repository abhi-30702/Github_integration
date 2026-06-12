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
  const raw = {
    name: 'old', description: '', language: null,
    stargazers_count: 0, forks_count: 0, open_issues_count: 0,
    archived: true, updated_at: new Date().toISOString(),
  };
  expect(mapRepo(raw).status).toBe('closed');
});

// ── mapEvent ──────────────────────────────────────────────────────────────────

test('mapEvent: PushEvent returns push type with commit count', () => {
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
  const raw = {
    type: 'WatchEvent',
    repo: { name: 'user/repo' },
    payload: {},
    created_at: new Date().toISOString(),
  };
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

test('mapContributions: returns empty on null response', () => {
  const result = mapContributions(null);
  expect(result.total).toBe(0);
  expect(result.weeks).toHaveLength(0);
});

// ── mapProfile ────────────────────────────────────────────────────────────────

test('mapProfile: derives language stats from repos', () => {
  const user = { name: 'Test', login: 'test', avatar_url: 'http://img', bio: '', location: '', public_repos: 5, followers: 10, following: 3 };
  const repos = [
    { language: 'TypeScript', stargazers_count: 10 },
    { language: 'TypeScript', stargazers_count: 5 },
    { language: 'Python', stargazers_count: 3 },
  ];
  const result = mapProfile(user, repos, 100);
  expect(result.languages[0].name).toBe('TypeScript');
  expect(result.commits).toBe(100);
  expect(result.stars).toBe(18);
});
