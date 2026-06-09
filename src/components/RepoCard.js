import React from 'react';

const STATUS_STYLES = {
  open: { bg: '#238636', label: 'Open' },
  merged: { bg: '#8957e5', label: 'Merged' },
  closed: { bg: '#da3633', label: 'Closed' },
};

export default function RepoCard({ repo }) {
  const s = STATUS_STYLES[repo.status];
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '1rem', cursor: 'pointer', transition: 'all .25s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateX(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
        <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--blue)' }}>📦 {repo.name}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {repo.prs > 0 && (
            <span style={{ padding: '3px 8px', borderRadius: 100, fontSize: '.68rem', fontFamily: 'var(--font-mono)', background: s.bg, color: '#fff' }}>
              {repo.prs} PR{repo.prs !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{ padding: '3px 8px', borderRadius: 100, fontSize: '.68rem', fontFamily: 'var(--font-mono)', background: s.bg + '33', color: s.bg === '#238636' ? '#3fb950' : s.bg === '#8957e5' ? '#bc8cff' : '#f85149', border: `1px solid ${s.bg}44` }}>
            {s.label}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: '.6rem', lineHeight: 1.45 }}>{repo.desc}</div>
      <div style={{ display: 'flex', gap: 12, fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: repo.langColor, display: 'inline-block' }} />
          {repo.lang}
        </span>
        <span>⭐ {repo.stars}</span>
        <span>🍴 {repo.forks}</span>
        <span style={{ marginLeft: 'auto' }}>{repo.updated}</span>
      </div>
    </div>
  );
}
