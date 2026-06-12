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
