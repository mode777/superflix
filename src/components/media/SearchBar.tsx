export function SearchBar({
  value,
  onChange,
  placeholder = 'Search titles, developers, publishers…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="relative flex w-full items-center md:max-w-sm">
      <span
        className="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-on-surface-variant"
        aria-hidden="true"
      >
        search
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search games"
        className="w-full rounded-xl border border-white/10 bg-surface-container-lowest/70 py-2.5 pl-10 pr-4 text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
