import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, MessageSquare } from 'lucide-react';
import type { Priority } from '@/api/generated/graphql';
import { cn } from '@/lib/utils';
import type { Card } from './board-state';

export const PRIORITY_STYLE: Record<Priority, { label: string; className: string }> = {
  HIGH: { label: 'High', className: 'bg-red-50 text-red-700 border-red-200' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  LOW: { label: 'Low', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const formatDue = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function CardBody({ card }: { card: Card }) {
  const p = PRIORITY_STYLE[card.priority];
  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{card.key}</span>
        <span className={cn('rounded border px-1.5 py-px text-[11px] font-medium', p.className)}>
          {p.label}
        </span>
      </div>
      <p className="text-sm leading-snug font-medium">{card.title}</p>
      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px]"
            >
              <span className="size-1.5 rounded-full" style={{ background: l.color }} aria-hidden />
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          {card.dueDate && (
            <span
              className={cn('inline-flex items-center gap-1', card.isOverdue && 'font-medium text-red-700')}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              {card.isOverdue ? 'Overdue · ' : ''}
              {formatDue(card.dueDate)}
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="inline-flex items-center gap-1" aria-label={`${card.commentCount} comments`}>
              <MessageSquare className="size-3.5" aria-hidden />
              {card.commentCount}
            </span>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {card.assignees.slice(0, 3).map((a) => (
            <span
              key={a.id}
              title={a.name}
              className="grid size-6 place-items-center rounded-full border-2 border-card bg-brand-100 text-[10px] font-semibold text-brand-800"
            >
              {initials(a.name)}
            </span>
          ))}
          {card.assignees.length > 3 && (
            <span className="grid size-6 place-items-center rounded-full border-2 border-card bg-muted text-[10px]">
              +{card.assignees.length - 3}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/** Draggable card. Click opens the task drawer; keyboard users press Enter. */
export function TaskCard({
  card,
  statusId,
  draggable,
  onOpen,
}: {
  card: Card;
  statusId: string;
  draggable: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', statusId, card },
    disabled: !draggable,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'cursor-pointer rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:border-brand-300 hover:shadow-sm',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
      aria-roledescription={draggable ? 'draggable task' : undefined}
      aria-label={`${card.key} ${card.title}`}
      onClick={() => onOpen(card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(card.id);
        else listeners?.onKeyDown?.(e);
      }}
    >
      <CardBody card={card} />
    </li>
  );
}
