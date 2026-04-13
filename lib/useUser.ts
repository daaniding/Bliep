'use client';

import { useEffect, useState, useCallback } from 'react';

export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
}

const USER_CHANGED_EVENT = 'bliep:user-changed';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(USER_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(USER_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { user, loading, refresh };
}

export function notifyUserChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

export async function apiSignup(username: string, password: string, displayName: string): Promise<User> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password, displayName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Signup mislukt');
  notifyUserChanged();
  return res.json();
}

export async function apiLogin(username: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Login mislukt');
  notifyUserChanged();
  return res.json();
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  notifyUserChanged();
}

export async function apiUpdateDisplayName(displayName: string): Promise<User | null> {
  const res = await fetch('/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) throw new Error('Update mislukt');
  const data = await res.json();
  notifyUserChanged();
  return data.user;
}
