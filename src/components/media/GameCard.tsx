import { Link } from 'react-router-dom';
import type { Game } from '@/types/games';
import { CoverArt } from './CoverArt';

function year(release: string): string {
  return release ? release.slice(0, 4) : '';
}

export function GameCard({ game }: { game: Game }) {
  return (
    <Link
      to={`/game/${game.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-surface-container/60 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-surface-container-high/80 hover:shadow-2xl"
    >
      <div className="aspect-[4/3] overflow-hidden">
        <CoverArt
          game={game}
          showTitle={false}
          className="transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-body-lg font-semibold text-on-surface">{game.title}</h3>
        <p className="text-body-md text-on-surface-variant">
          {[game.developer, year(game.release)].filter(Boolean).join(' • ')}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-label-caps uppercase tracking-wider text-on-surface-variant">
            {game.genre}
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-label-caps uppercase tracking-wider text-on-surface-variant">
            {game.region}
          </span>
        </div>
      </div>
    </Link>
  );
}
