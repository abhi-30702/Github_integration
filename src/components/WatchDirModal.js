import React, { useState } from 'react';

export default function WatchDirModal({ onSelect, onDismiss }) {
  const [loading, setLoading] = useState(false);

  const handlePick = async () => {
    setLoading(true);
    const dir = await window.electronAPI.pickWatchDir();
    setLoading(false);
    if (dir) onSelect(dir);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', width: 420, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📂</div>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.5rem' }}>Set your projects folder</div>
        <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          GitHub Dashboard will watch this folder for new projects and offer to create a GitHub repository automatically when you add one.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onDismiss} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem' }}>
            Skip for now
          </button>
          <button onClick={handlePick} disabled={loading} style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: loading ? 'var(--border)' : '#238636',
            color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '.85rem', fontWeight: 600,
          }}>
            {loading ? 'Selecting…' : 'Choose folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
