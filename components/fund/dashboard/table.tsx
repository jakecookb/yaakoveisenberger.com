import { cn } from '../ui/cn';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('whitespace-nowrap border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs font-medium text-slate-500', className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('border-b border-slate-100 px-4 py-3 align-middle text-slate-700', className)}>{children}</td>;
}
