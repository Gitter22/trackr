import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { TaskFilter } from '@/api/generated/graphql';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cardsOf } from './board-state';
import { useColumn, useTaskMutations } from './queries';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  projectId: string;
  status: { id: string; name: string; color: string; category: string };
  filter: TaskFilter;
  canCreate: boolean;
  canMove: boolean;
  onOpen: (id: string) => void;
}

function QuickAdd({
  projectId,
  statusId,
  onDone,
}: {
  projectId: string;
  statusId: string;
  onDone: () => void;
}) {
  const { create } = useTaskMutations(projectId);
  const [title, setTitle] = useState('');
  return (
    <form
      className="mb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return onDone();
        create.mutate(
          { projectId, statusId, title: title.trim() },
          {
            onSuccess: (r) => (toast.success(`${r.createTask.key} created`), setTitle('')),
            onError: (err) => toast.error(errorMessage(err)),
          },
        );
      }}
    >
      <Input
        autoFocus
        aria-label="New task title"
        placeholder="Task title, then Enter"
        value={title}
        disabled={create.isPending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        onBlur={() => !title.trim() && onDone()}
        className="bg-card"
      />
    </form>
  );
}

/** One status column: cursor-paged cards (loads more on scroll), drop target, quick add. */
export function Column({ projectId, status, filter, canCreate, canMove, onOpen }: ColumnProps) {
  const column = useColumn(projectId, status.id, filter);
  const cards = cardsOf(column.data);
  const total = column.data?.pages[0]?.totalCount ?? 0;
  const [adding, setAdding] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status.id}`,
    data: { type: 'column', statusId: status.id },
  });

  // Load the next page when the bottom of the list scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = column;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${status.name} column`}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-muted/70 p-2 transition-colors',
        isOver && 'bg-brand-50 ring-2 ring-brand-200',
      )}
    >
      <header className="mb-2 flex items-center justify-between px-1 pt-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: status.color }} aria-hidden />
          {status.name}
          <span className="rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
            {total}
          </span>
        </h2>
        {canCreate && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={`Add task to ${status.name}`}
            onClick={() => setAdding(true)}
          >
            <Plus />
          </Button>
        )}
      </header>
      {adding && <QuickAdd projectId={projectId} statusId={status.id} onDone={() => setAdding(false)} />}
      <div className="max-h-[calc(100vh-15rem)] min-h-24 overflow-y-auto pr-0.5">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2">
            {cards.map((card) => (
              <TaskCard key={card.id} card={card} statusId={status.id} draggable={canMove} onOpen={onOpen} />
            ))}
          </ul>
        </SortableContext>
        {column.isPending && (
          <Loader2
            className="mx-auto my-4 size-5 animate-spin text-muted-foreground"
            aria-label="Loading tasks"
          />
        )}
        {column.isError && <p className="p-2 text-xs text-destructive">{errorMessage(column.error)}</p>}
        {!column.isPending && cards.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tasks</p>
        )}
        <div ref={sentinel} />
        {hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading…' : `Load more (${total - cards.length} left)`}
          </Button>
        )}
      </div>
    </section>
  );
}
