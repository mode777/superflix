import { useState } from 'react';
import { adminAuth } from './lib/pb-auth';
import { AmbientBackground } from '@/components/media/AmbientBackground';

export function SignInView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminAuth.signInWithPassword(email.trim(), password);
    } catch {
      setError('Invalid superuser credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AmbientBackground accent="#5b9dff" secondary="#d92d3a" />
      <main className="flex min-h-screen items-center justify-center px-margin-mobile py-24 md:px-margin-desktop">
        <div className="glass-panel w-full max-w-md rounded-2xl p-8">
          <header className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-label-caps uppercase tracking-[0.2em] text-primary">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                lock
              </span>
              Admin
            </span>
            <h1 className="text-headline-lg text-on-surface">Superuser sign in</h1>
            <p className="text-body-md text-on-surface-variant">
              The importer and catalog editor are restricted to the PocketBase superuser.
            </p>
          </header>

          <form onSubmit={(event) => void onSubmit(event)} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Email
              </span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-lg border border-white/10 bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-lg border border-white/10 bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-error/20 bg-error-container/10 px-3 py-2 text-body-md text-error"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-5 py-2.5 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-body-md text-on-surface-variant/80">
            Local development: create a superuser with{' '}
            <code className="font-mono text-on-surface">
              ./bin/pocketbase superuser upsert you@example.com password
            </code>
            .
          </p>
        </div>
      </main>
    </>
  );
}
