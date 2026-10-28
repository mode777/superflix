import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { BrandMark } from '@/components/BrandMark';
import { AuthForm } from '@/features/auth/AuthForm';
import { auth } from '@/features/auth/auth';
import { useAuthStore } from '@/features/auth/authStore';

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'rounded-lg px-3 py-2 text-body-md font-medium transition-colors',
          isActive
            ? 'bg-white/10 text-on-surface'
            : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface',
        )
      }
    >
      {children}
    </NavLink>
  );
}

function AccountMenu() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-body-md font-medium text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          account_circle
        </span>
        <span className="hidden max-w-[120px] truncate sm:inline">
          {isAuthenticated ? (user?.email ?? 'Account') : 'Sign in'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-surface-container-high shadow-2xl">
          {isAuthenticated ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                  Signed in as
                </span>
                <span className="truncate text-body-md text-on-surface">
                  {user?.email ?? 'Account'}
                </span>
              </div>
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="text-body-md text-on-surface-variant underline-offset-2 hover:text-on-surface hover:underline"
              >
                Back to favorites
              </Link>
              <button
                type="button"
                onClick={() => {
                  auth.signOut();
                  setOpen(false);
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
              >
                Sign out
              </button>
            </div>
          ) : (
            <AuthForm onDone={() => setOpen(false)} />
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto max-w-page px-margin-mobile md:px-margin-desktop">
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-surface-container/70 px-3 py-2.5 shadow-2xl backdrop-blur-xl md:px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-9 w-9 shrink-0" />
            <span className="truncate text-headline-lg font-semibold tracking-tight text-on-surface">
              Superflix
            </span>
            <span className="hidden text-label-caps uppercase tracking-[0.18em] text-on-surface-variant lg:inline">
              Super Nintendo Catalog
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <NavItem to="/">Browse</NavItem>
            <NavItem to="/admin">Import</NavItem>
            <AccountMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
