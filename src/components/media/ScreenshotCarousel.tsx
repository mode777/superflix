export function ScreenshotCarousel({
  screenshots,
  title,
}: {
  screenshots: string[];
  title: string;
}) {
  if (screenshots.length === 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/10 bg-surface-container-low/50"
          >
            <div className="flex flex-col items-center gap-2 text-on-surface-variant/60">
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

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {screenshots.map((src, index) => (
        <img
          key={src}
          src={src}
          alt={`${title} screenshot ${index + 1}`}
          loading="lazy"
          className="aspect-video w-[min(78vw,520px)] shrink-0 snap-start rounded-xl border border-white/10 object-cover"
        />
      ))}
    </div>
  );
}
