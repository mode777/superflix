import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { Game } from '@/types/games';

export function CoverArt({
  game,
  className,
  showTitle = true,
}: {
  game: Game;
  className?: string;
  showTitle?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (game.coverUrl && !failed) {
    return (
      <img
        src={game.coverUrl}
        alt={`${game.title} cover`}
        className={cn('h-full w-full object-cover', className)}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const [from, to] = game.coverColors;

  return (
    <div
      className={cn('relative flex h-full w-full flex-col justify-end overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      role="img"
      aria-label={`${game.title} placeholder cover`}
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(255,255,255,0.45), transparent 45%), radial-gradient(circle at 85% 80%, rgba(0,0,0,0.5), transparent 55%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 4px)',
        }}
      />
      <div className="relative z-10 flex flex-col gap-1 p-4">
        <span className="text-label-caps uppercase tracking-[0.2em] text-white/70">
          {game.genre}
        </span>
        {showTitle && (
          <span className="text-headline-lg font-semibold leading-tight text-white drop-shadow-lg">
            {game.title}
          </span>
        )}
      </div>
    </div>
  );
}
