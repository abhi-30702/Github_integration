import React, { useState } from 'react';

export default function CreateRepoModal({ folderName = '', folderPath = null, onConfirm, onSkip }) {
  const [name,      setName]      = useState(folderName);
  const [desc,      setDesc]      = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const sanitize = (v) => v.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^[-.]/, '');

  const handleCreate = async () => {
    const repoName = name.trim();
    if (!repoName) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.createRepo({
        name: repoName,
        description: desc.trim(),
        isPrivate,
        localPath: folderPath,
      });
      onConfirm(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onSkip(); }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', width: 420, maxWidth: '90vw' }}>

        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: folderPath ? '.4rem' : '1rem' }}>
          {folderPath ? '📁 New folder detected' : '✨ New Project'}
        </div>

        {folderPath && (
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '1rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', background: 'var(--surface2)', padding: '6px 10px', borderRadius: 6 }}>
            {folderPath}
          </div>
        )}

        <label style={{ fontSize: '.75rem', color: 'var(--muted)', display: 'block', marginBottom: '.3rem' }}>Repository name</label>
        <input
          value={name}
          onChange={e => setName(sanitize(e.target.value))}
          placeholder="my-project"
          autoFocus
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: '.85rem', boxSizing: 'border-box', marginBottom: '.75rem', outline: 'none' }}
        />

        <label style={{ fontSize: '.75rem', color: 'var(--muted)', display: 'block', marginBottom: '.3rem' }}>
          Description <span style={{ opacity: .5 }}>(optional)</span>
        </label>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Short description…"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: '.85rem', boxSizing: 'border-box', marginBottom: '.75rem', outline: 'none' }}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {['Private', 'Public'].map(v => {
            const active = (v === 'Private') === isPrivate;
            return (
              <button key={v} onClick={() => setIsPrivate(v === 'Private')} style={{
                flex: 1, padding: '8px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--border2)' : 'var(--border)'}`,
                background: active ? 'var(--border2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--muted)', fontSize: '.82rem',
              }}>
                {v === 'Private' ? '🔒' : '🌐'} {v}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ color: '#f85149', fontSize: '.78rem', marginBottom: '.75rem', lineHeight: 1.4 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onSkip} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem' }}>
            Skip
          </button>
          <button onClick={handleCreate} disabled={loading || !name.trim()} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none',
            background: loading || !name.trim() ? 'var(--border)' : '#238636',
            color: '#fff', cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
            fontSize: '.85rem', fontWeight: 600, transition: 'background .2s',
          }}>
            {loading ? (folderPath ? 'Creating & pushing…' : 'Creating…') : 'Create Repo'}
          </button>
        </div>
      </div>
    </div>
  );
}
