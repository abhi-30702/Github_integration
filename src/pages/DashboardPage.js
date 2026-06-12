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
  const { user, logout }                                                      = useAuth();
  const { repos, activity, contributions, profile, loading, error, refresh } = useGitHubData(user);

  const [search,         setSearch]         = useState('');
  const [filter,         setFilter]         = useState('All');
  const [detectedFolder, setDetectedFolder] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showWatchDir,   setShowWatchDir]   = useState(false);
  const [toast,          setToast]          = useState(null);

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

  const handleRepoCreated = useCallback(({ name }) => {
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
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '1.1rem' }}>
          {GH_ICON} GitHub Dashboard
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px' }}>
            <svg width="13" height="13" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input placeholder="Search repos…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '.8rem', width: 160 }} />
          </div>
          <button onClick={() => setShowNewProject(true)} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: '#238636', color: '#fff', cursor: 'pointer',
            fontSize: '.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            + New Project
          </button>
          <button onClick={refresh} disabled={loading} title="Refresh" style={{
            padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--muted)', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '.85rem',
          }}>
            {loading ? '⏳' : '🔄'}
          </button>
          <div onClick={logout} title="Sign out" style={{
            width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
            cursor: 'pointer', border: '2px solid var(--border)',
          }}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user.login} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#bc8cff,#58a6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.75rem' }}>
                  {user?.login?.[0]?.toUpperCase()}
                </div>
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
        ? <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem' }}>
            <Skeleton width={72} height={72} radius={50} />
            <div style={{ flex: 1 }}>
              <Skeleton height={20} width="40%" style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="25%" style={{ marginBottom: 12 }} />
              <Skeleton height={12} width="60%" />
            </div>
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
              ? [1, 2, 3].map(i => <Skeleton key={i} height={90} radius={10} />)
              : visible.length > 0
                ? visible.map(r => <RepoCard key={r.name} repo={r} />)
                : <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    No repos match your search.
                  </div>
            }
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
          {loading && activity.length === 0
            ? <>{[1, 2, 3, 4].map(i => <Skeleton key={i} height={44} radius={6} style={{ marginBottom: 8 }} />)}</>
            : <ActivityFeed events={activity} />
          }
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>GitHub Dashboard v1.0.0</div>
        <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>api.github.com · {user?.login}</div>
      </div>

      {/* MODALS — wired in Tasks 10–13, placeholders here */}
      {(detectedFolder || showNewProject) && (
        <CreateRepoModalPlaceholder
          folderName={detectedFolder?.folderName || ''}
          folderPath={detectedFolder?.folderPath || null}
          onConfirm={handleRepoCreated}
          onSkip={handleSkip}
          onClose={() => { setDetectedFolder(null); setShowNewProject(false); }}
        />
      )}
      {showWatchDir && (
        <WatchDirModalPlaceholder onClose={() => setShowWatchDir(false)} />
      )}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: toast.type === 'success' ? '#238636' : '#da3633',
          color: '#fff', padding: '12px 16px', borderRadius: 8,
          fontSize: '.85rem', cursor: 'pointer', zIndex: 2000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }} onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Temporary placeholders — replaced by real components in Tasks 12–13
function CreateRepoModalPlaceholder({ folderName, folderPath, onConfirm, onSkip, onClose }) {
  const [name, setName] = React.useState(folderName);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.createRepo({ name: name.trim(), description: '', isPrivate: true, localPath: folderPath });
      onConfirm(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', width: 380 }}>
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>{folderPath ? '📁 New folder detected' : '✨ New Project'}</div>
        {folderPath && <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '.75rem', fontFamily: 'var(--font-mono)' }}>{folderPath}</div>}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="repo-name"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: '.85rem', boxSizing: 'border-box', marginBottom: '.75rem' }} />
        {error && <div style={{ color: '#f85149', fontSize: '.78rem', marginBottom: '.75rem' }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onSkip} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>Skip</button>
          <button onClick={handleCreate} disabled={loading || !name.trim()} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#238636', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? 'Creating…' : 'Create Repo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WatchDirModalPlaceholder({ onClose }) {
  const [loading, setLoading] = React.useState(false);
  const handlePick = async () => {
    setLoading(true);
    const dir = await window.electronAPI.pickWatchDir();
    setLoading(false);
    if (dir) onClose();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', width: 400, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📂</div>
        <div style={{ fontWeight: 700, marginBottom: '.5rem' }}>Set your projects folder</div>
        <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          GitHub Dashboard will watch this folder for new projects.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>Skip for now</button>
          <button onClick={handlePick} disabled={loading} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#238636', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? 'Selecting…' : 'Choose folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
