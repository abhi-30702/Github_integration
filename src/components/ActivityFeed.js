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
            <div style={{ flex: 1, minWidth: 0 }}>
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
