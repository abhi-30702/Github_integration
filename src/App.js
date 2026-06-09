import React, { useState } from 'react';
import ProfileCard from './components/ProfileCard';
import ContributionGrid from './components/ContributionGrid';
import RepoCard from './components/RepoCard';
import ActivityFeed from './components/ActivityFeed';
import { REPOS } from './data';

const GH_ICON = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const FILTERS = ['All', 'TypeScript', 'Python', 'JavaScript'];

export default function App() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const visible = REPOS.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.desc.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || r.lang === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem', minHeight: '100vh' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '1.1rem' }}>
          {GH_ICON} GitHub Connect
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px' }}>
          <svg width="13" height="13" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input
            placeholder="Search repos…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '.8rem', width: 160 }}
          />
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#bc8cff,#58a6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.75rem', cursor: 'pointer' }}>AB</div>
      </div>

      {/* PROFILE */}
      <ProfileCard />

      {/* CONTRIBUTION GRID */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ContributionGrid />
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
                  color: filter === f ? 'var(--text)' : 'var(--muted)',
                  transition: 'all .2s',
                }}>{f}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            {visible.map(r => <RepoCard key={r.name} repo={r} />)}
            {visible.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                No repos match your search.
              </div>
            )}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
          <ActivityFeed />
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>GitHub Integration v1.0.0</div>
        <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>api.github.com · Last sync: now</div>
      </div>
    </div>
  );
}
