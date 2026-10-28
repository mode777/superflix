import { useState } from 'react';
import { auth } from './auth';
import { showToast } from '@/lib/toast';

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await auth.signUp(email.trim(), password);
        showToast('Account created — you are signed in.', { kind: 'success' });
      } else {
        await auth.signIn(email.trim(), password);
        showToast('Signed in.', { kind: 'success' });
      }
      onDone?.();
    } catch {
      setError(
        mode === 'signup'
          ? 'Could not create the account. Check the email and password requirements.'
          : 'Invalid email or password.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 p-4">
      <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-md px-3 py-1.5 text-body-md ${
            mode === 'signin' ? 'bg-white/10 text-on-surface' : 'text-on-surface-variant'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-md px-3 py-1.5 text-body-md ${
            mode === 'signup' ? 'bg-white/10 text-on-surface' : 'text-on-surface-variant'
          }`}
        >
          Create account
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
          Email
        </span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-white/10 bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface focus:border-primary/60 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
          Password
        </span>
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-white/10 bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface focus:border-primary/60 focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="text-body-md text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-4 py-2 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
      <p className="text-body-md text-on-surface-variant/80">
        An account is only needed for favorites and cloud saves. Browsing and playing stay open to
        everyone.
      </p>
    </form>
  );
}
