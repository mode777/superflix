import { cn } from '@/lib/cn';

export function AmbientBackground({
  accent = '#5b9dff',
  secondary = '#d92d3a',
  className,
}: {
  accent?: string;
  secondary?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
    >
      <div
        className="absolute -top-64 left-1/2 h-[720px] w-[1100px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 68%)` }}
      />
      <div
        className="absolute -bottom-80 -right-40 h-[640px] w-[640px] rounded-full opacity-15 blur-3xl"
        style={{ background: `radial-gradient(circle, ${secondary} 0%, transparent 70%)` }}
      />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}
