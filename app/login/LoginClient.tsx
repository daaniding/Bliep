'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiLogin } from '@/lib/useUser';

export default function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiLogin(username, password);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login mislukt');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-[10px] text-faint uppercase tracking-[0.2em] font-medium mb-3">Bliep</p>
          <h1 className="font-serif text-3xl text-ink italic">Welkom terug</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Gebruikersnaam</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
              className="w-full bg-subtle border border-transparent rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-subtle border border-transparent rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm"
            />
          </div>
          {error && <p className="text-[#7a2e1a] text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl glow-accent active:scale-[0.98] transition-transform disabled:opacity-50 text-sm"
          >
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-muted text-xs">
            Nog geen account? <Link href="/signup" className="text-accent font-medium">Maak er een</Link>
          </p>
          <p className="text-faint text-xs">
            <Link href="/" className="hover:text-muted">← Verder zonder account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
