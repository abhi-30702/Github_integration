import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

beforeEach(() => {
  window.electronAPI = {
    getAuthState: jest.fn().mockResolvedValue({ user: { login: 'testuser', name: 'Test User' } }),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
});

function DisplayUser() {
  const { user, loading } = useAuth();
  if (loading) return <span>loading</span>;
  return <span>{user ? user.login : 'no-user'}</span>;
}

test('loads user from getAuthState on mount', async () => {
  render(<AuthProvider><DisplayUser /></AuthProvider>);
  expect(screen.getByText('loading')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument());
});
