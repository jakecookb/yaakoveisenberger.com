import { cn } from './cn';

/** Stat tile: sentence-case label, semibold value, optional context line. */
export function StatTile({ label, value, sub, icon, className, emphasis }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; className?: string; emphasis?: boolean }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 sm:p-5', emphasis && 'border-[var(--fund-accent-track)] bg-[var(--fund-accent-soft)]', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && <span className="text-slate-400" aria-hidden>{icon}</span>}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/** Meter: accent fill on a lighter step of the same hue. */
export function Meter({ value, max, className, label, height = 'h-2' }: { value: number; max: number; className?: string; label?: string; height?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-[var(--fund-accent-track)]', height, className)} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="h-full rounded-full bg-[var(--fund-accent)] transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
