export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="SNESflix"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="snesflix-mark" x1="4" y1="4" x2="36" y2="36">
          <stop offset="0" stopColor="#b9a6ff" />
          <stop offset="0.55" stopColor="#6d4aff" />
          <stop offset="1" stopColor="#ffb703" />
        </linearGradient>
      </defs>
      <rect x="3" y="7" width="34" height="26" rx="9" fill="url(#snesflix-mark)" />
      <rect x="7" y="11" width="26" height="18" rx="6" fill="#121014" opacity="0.72" />
      <circle cx="14" cy="20" r="3" fill="#ffd166" />
      <circle cx="21" cy="20" r="3" fill="#ff8fbf" />
      <rect x="27" y="16" width="3" height="8" rx="1.5" fill="#e9e4f0" />
      <rect x="24.5" y="18.5" width="8" height="3" rx="1.5" fill="#e9e4f0" />
    </svg>
  );
}
