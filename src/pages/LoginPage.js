import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const GH_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

export default function LoginPage() {
  const { login }             = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await window.electronAPI.startOAuth();
      login(user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '2.5rem', width: 360, textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>🦁</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '.4rem' }}>GitHub Dashboard</div>
        <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.5 }}>
          Sign in to see your live repositories, contributions, and activity feed.
        </div>

        <button onClick={handleSignIn} disabled={loading} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
          background: loading ? 'var(--border)' : '#238636',
          color: '#fff', fontSize: '.9rem', fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s',
        }}>
          {GH_ICON}
          {loading ? 'Opening GitHub...' : 'Sign in with GitHub'}
        </button>

        {error && (
          <div style={{ marginTop: '1rem', color: '#f85149', fontSize: '.8rem', lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          Requires repo, user, read:org scope
        </div>
      </div>
    </div>
  );
}
