export function AttributionPanel() {
  return (
    <details className="glass-panel mt-12 rounded-2xl p-6">
      <summary className="cursor-pointer text-headline-lg text-on-surface">
        Metadata &amp; artwork credits
      </summary>
      <div className="mt-4 flex flex-col gap-3 text-body-md text-on-surface-variant">
        <p>
          Game names and checksums come from the{' '}
          <a
            href="https://no-intro.org/"
            className="underline underline-offset-2 hover:text-on-surface"
            target="_blank"
            rel="noreferrer"
          >
            No-Intro
          </a>{' '}
          database (headerless DATs).
        </p>
        <p>
          Developer, publisher, genre, release year, and player counts come from{' '}
          <a
            href="https://github.com/libretro/libretro-database"
            className="underline underline-offset-2 hover:text-on-surface"
            target="_blank"
            rel="noreferrer"
          >
            libretro-database
          </a>{' '}
          (CC-BY-SA-4.0).
        </p>
        <p>
          Boxart, title screens, and in-game screenshots come from{' '}
          <a
            href="https://github.com/libretro-thumbnails/libretro-thumbnails"
            className="underline underline-offset-2 hover:text-on-surface"
            target="_blank"
            rel="noreferrer"
          >
            libretro-thumbnails
          </a>
          . Artwork copyright belongs to the respective game publishers and is shown for
          identification purposes.
        </p>
        <p>
          See <code className="font-mono text-on-surface">ATTRIBUTION.md</code> in the repository
          for the full list of sources and licenses.
        </p>
      </div>
    </details>
  );
}
