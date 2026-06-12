import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: '2rem', color: 'var(--text)' }}>
      <p>Logged in as <b>{user?.login}</b></p>
      <button onClick={logout} style={{ padding: '8px 16px', background: '#238636', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Sign out</button>
    </div>
  );
}
