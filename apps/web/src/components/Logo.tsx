import { cn } from '@/lib/utils';

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        T
      </span>
      <div className="leading-tight">
        <p className="font-semibold">Trcker</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
