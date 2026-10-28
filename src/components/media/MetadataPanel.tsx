import type { Game } from '@/types/games';

function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(
    date,
  );
}

export function MetadataPanel({ game }: { game: Game }) {
  const rows = [
    { label: 'Developer', value: game.developer },
    { label: 'Publisher', value: game.publisher },
    { label: 'Released', value: formatDate(game.release) },
    { label: 'Players', value: game.players },
    { label: 'Region', value: game.region },
    { label: 'Genre', value: game.genre },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <dt className="text-label-caps uppercase tracking-[0.18em] text-on-surface-variant">
            {row.label}
          </dt>
          <dd className="text-body-md text-on-surface">{row.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
