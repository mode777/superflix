import { NavLink, Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { BrandMark } from '@/components/BrandMark';

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
          </nav>
        </div>
      </div>
    </header>
  );
}
