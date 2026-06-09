import React from 'react';
import { PROFILE, LANGUAGES } from '../data';

export default function ProfileCard() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', transition: 'border-color .3s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'start' }}>

        {/* Avatar */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#bc8cff,#58a6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
          {PROFILE.avatar}
        </div>

        {/* Info */}
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '.15rem' }}>{PROFILE.name}</div>
          <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '.82rem', marginBottom: '.55rem' }}>@{PROFILE.handle}</div>
          <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: '.7rem', lineHeight: 1.5 }}>{PROFILE.bio}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { label: `🌍 ${PROFILE.location}`, color: '#58a6ff' },
              { label: '⚡ TypeScript', color: '#3178c6' },
              { label: '🐍 Python', color: '#3572A5' },
              { label: '⚛️ React', color: '#61dafb' },
            ].map(c => (
              <span key={c.label} style={{ padding: '4px 10px', borderRadius: 100, fontSize: '.7rem', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', color: c.color }}>
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
            {[
              { val: PROFILE.repos, label: 'Repos' },
              { val: PROFILE.followers.toLocaleString(), label: 'Followers' },
              { val: PROFILE.commits.toLocaleString(), label: 'Commits' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', padding: '.75rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '.1rem' }}>{s.val}</div>
                <div style={{ fontSize: '.66rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Language bar */}
          <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginBottom: '.35rem' }}>Top Languages</div>
          <div style={{ display: 'flex', height: 6, borderRadius: 100, overflow: 'hidden', gap: 1 }}>
            {LANGUAGES.map(l => <div key={l.name} style={{ flex: l.pct, background: l.color }} title={`${l.name}: ${l.pct}%`} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '.4rem', flexWrap: 'wrap' }}>
            {LANGUAGES.map(l => (
              <span key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '.65rem', color: 'var(--muted)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, display: 'inline-block' }} />{l.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
