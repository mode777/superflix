import { useState } from 'react';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { CatalogTab } from '@/admin/catalog/CatalogTab';
import { ImportQueueTab } from '@/admin/import/ImportQueueTab';
import { useAdminAuthStore } from '@/admin/lib/authStore';
import { adminAuth } from '@/admin/lib/pb-auth';

type AdminTab = 'identify' | 'catalog';

function tabClass(active: boolean): string {
  return active
    ? 'rounded-lg bg-white/[0.08] px-4 py-2 text-body-md font-semibold text-on-surface'
    : 'rounded-lg px-4 py-2 text-body-md text-on-surface-variant transition hover:text-on-surface';
}

export default function AdminView() {
  const adminUser = useAdminAuthStore((state) => state.user);
  const [tab, setTab] = useState<AdminTab>('identify');

  return (
    <>
      <AmbientBackground accent="#5b9dff" secondary="#d92d3a" />
      <main className="relative mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-label-caps uppercase tracking-[0.2em] text-primary">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                fingerprint
              </span>
              Importer
            </span>
            <h1 className="mt-4 text-headline-xl-mobile font-extrabold tracking-tight text-on-surface md:text-headline-xl">
              {tab === 'identify' ? 'Import games' : 'Manage the catalog'}
            </h1>
            <p className="mt-3 max-w-2xl text-body-lg text-on-surface-variant">
              {tab === 'identify'
                ? 'Drop one or many Super Nintendo ROMs, or a whole folder. Everything is identified, previewed, and editable in your browser — nothing is written until you add it.'
                : 'Edit metadata, replace a ROM file, or remove a game. Changes are written with the dedicated superuser client.'}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="max-w-[220px] truncate text-body-md text-on-surface-variant">
              {adminUser?.email ?? 'Superuser'}
            </span>
            <button
              type="button"
              onClick={() => adminAuth.signOut()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-6 inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'identify'}
            onClick={() => setTab('identify')}
            className={tabClass(tab === 'identify')}
          >
            Identify
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'catalog'}
            onClick={() => setTab('catalog')}
            className={tabClass(tab === 'catalog')}
          >
            Catalog
          </button>
        </div>

        {tab === 'catalog' ? <CatalogTab /> : <ImportQueueTab />}
      </main>
    </>
  );
}
