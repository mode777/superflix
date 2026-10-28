export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Superflix"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="superflix-mark" x1="4" y1="4" x2="36" y2="36">
          <stop offset="0" stopColor="#4a5058" />
          <stop offset="1" stopColor="#22262b" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="7"
        width="34"
        height="26"
        rx="9"
        fill="url(#superflix-mark)"
        stroke="#8b949e"
        strokeWidth="1.4"
      />
      <rect x="7" y="11" width="26" height="18" rx="6" fill="#101214" />
      <circle cx="13" cy="20" r="2.6" fill="#d92d3a" />
      <circle cx="19" cy="20" r="2.6" fill="#ffd23f" />
      <circle cx="25" cy="20" r="2.6" fill="#4ade80" />
      <circle cx="31" cy="20" r="2.6" fill="#5b9dff" />
      <rect x="16" y="25" width="8" height="1.6" rx="0.8" fill="#8b949e" opacity="0.65" />
    </svg>
  );
}
