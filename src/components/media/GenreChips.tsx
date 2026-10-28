import { cn } from '@/lib/cn';

export function GenreChips({
  genres,
  value,
  onChange,
}: {
  genres: string[];
  value: string;
  onChange: (genre: string) => void;
}) {
  return (
    <div className="flex w-full gap-2 overflow-x-auto pb-1 md:w-auto md:flex-wrap md:pb-0">
      {genres.map((genre) => {
        const active = genre === value;
        return (
          <button
            key={genre}
            type="button"
            onClick={() => onChange(genre)}
            aria-pressed={active}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-body-md font-medium transition-colors',
              active
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-white/10 bg-white/[0.03] text-on-surface-variant hover:border-white/20 hover:text-on-surface',
            )}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}
