import { useRef, useState } from 'react';

function PlaceholderGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/10 bg-surface-container-low/50"
        >
          <div className="flex flex-col items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
              image
            </span>
            <span className="text-label-caps uppercase tracking-[0.18em]">No screenshot</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScreenshotCarousel({
  screenshots,
  title,
}: {
  screenshots: string[];
  title: string;
}) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const stripRef = useRef<HTMLDivElement>(null);

  if (screenshots.length === 0) return <PlaceholderGrid />;

  const visible = screenshots.filter((src) => !failed.has(src));
  if (visible.length === 0) return <PlaceholderGrid />;

  const scrollByPage = (direction: number) => {
    const strip = stripRef.current;
    strip?.scrollBy?.({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div>
      {visible.length > 1 && (
        <div className="mb-2 flex justify-end gap-2">
          <button
            type="button"
            aria-label="Previous screenshot"
            onClick={() => scrollByPage(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-on-surface-variant transition hover:border-white/25 hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              chevron_left
            </span>
          </button>
          <button
            type="button"
            aria-label="Next screenshot"
            onClick={() => scrollByPage(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-on-surface-variant transition hover:border-white/25 hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </div>
      )}

      <div ref={stripRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {visible.map((src, index) => (
          <img
            key={src}
            src={src}
            alt={`${title} screenshot ${index + 1}`}
            loading="lazy"
            onError={() =>
              setFailed((current) => {
                const next = new Set(current);
                next.add(src);
                return next;
              })
            }
            className="aspect-video w-[min(78vw,520px)] shrink-0 snap-start rounded-xl border border-white/10 object-cover"
          />
        ))}
      </div>
    </div>
  );
}
