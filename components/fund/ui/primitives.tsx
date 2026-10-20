'use client';

import { forwardRef, useId } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--fund-accent)] text-white shadow-sm hover:bg-[var(--fund-accent-strong)] focus-visible:outline-[var(--fund-accent)]',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-400',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50 focus-visible:outline-red-400',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  accent: 'bg-[var(--fund-accent-soft)] text-[var(--fund-accent-strong)] ring-[var(--fund-accent-track)]',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
};
const dots: Record<Tone, string> = {
  neutral: 'bg-slate-400', accent: 'bg-[var(--fund-accent)]', success: 'bg-emerald-500',
  warning: 'bg-amber-500', danger: 'bg-red-500', info: 'bg-sky-500',
};

export function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: 'success', succeeded: 'success', processed: 'success', connected: 'success', collected: 'success', live: 'success',
  pending_review: 'warning', pending: 'warning', paused: 'warning', invoiced: 'warning', received: 'warning', disputed: 'danger',
  failed: 'danger', refunded: 'neutral', canceled: 'neutral', archived: 'neutral', draft: 'neutral', ignored: 'neutral',
  completed: 'info', pledged: 'info', suspended: 'danger',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

const fieldBase =
  'block w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-[var(--fund-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--fund-accent-soft)] disabled:bg-slate-50 disabled:text-slate-500';

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children(id)}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-24 py-2', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  );
});

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fund-accent)] disabled:opacity-50',
          checked ? 'bg-[var(--fund-accent)]' : 'bg-slate-300',
        )}
      >
        <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {description && <span className="block text-slate-500">{description}</span>}
      </label>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
