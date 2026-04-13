'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiSignup } from '@/lib/useUser';

export default function SignupClient() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiSignup(username, password, displayName || username);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account aanmaken mislukt');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-[10px] text-faint uppercase tracking-[0.2em] font-medium mb-3">Bliep</p>
          <h1 className="font-serif text-3xl text-ink italic">Maak een account</h1>
          <p className="text-muted text-xs mt-2">Sla je trofeeën op en speel mee in echte friend leagues — over al je apparaten heen.</p>
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
              minLength={3}
              maxLength={24}
              required
              placeholder="3-24 letters/cijfers/_-"
              className="w-full bg-subtle border border-transparent rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Naam in friend league</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={24}
              placeholder="Hoe vrienden je zien (optioneel)"
              className="w-full bg-subtle border border-transparent rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
              placeholder="Minstens 6 tekens"
              className="w-full bg-subtle border border-transparent rounded-xl px-4 py-3 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white transition-all text-sm"
            />
          </div>
          {error && <p className="text-[#7a2e1a] text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-semibold py-3.5 rounded-2xl glow-accent active:scale-[0.98] transition-transform disabled:opacity-50 text-sm"
          >
            {loading ? 'Aanmaken...' : 'Account aanmaken'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-muted text-xs">
            Heb je al een account? <Link href="/login" className="text-accent font-medium">Log in</Link>
          </p>
          <p className="text-faint text-xs">
            <Link href="/" className="hover:text-muted">← Verder zonder account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
