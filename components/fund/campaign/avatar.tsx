import { initials } from '@/lib/fund/format';
import { cn } from '../ui/cn';

export function Avatar({ name, src, className, accent }: { name: string; src?: string | null; className?: string; accent?: boolean }) {
  if (src) return <img src={src} alt="" className={cn('size-9 shrink-0 rounded-full object-cover', className)} />;
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        accent ? 'bg-[var(--fund-accent-soft)] text-[var(--fund-accent-strong)]' : 'bg-slate-100 text-slate-600',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
