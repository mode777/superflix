export function EmptyState({
  icon = 'sports_esports',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
      <span className="material-symbols-outlined text-[40px] text-primary/70" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-headline-lg text-on-surface">{title}</h2>
      <p className="max-w-md text-body-md text-on-surface-variant">{description}</p>
      {action}
    </div>
  );
}
