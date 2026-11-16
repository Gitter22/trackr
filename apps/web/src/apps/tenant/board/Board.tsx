import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { TaskFilter } from '@/api/generated/graphql';
import { cardsOf, planMove, withOrder, withoutCard, type Card, type ColumnData } from './board-state';
import { Column } from './Column';
import { boardKeys, useTaskMutations } from './queries';
import { CardBody } from './TaskCard';

/**
 * Drop target = what is under the pointer: a card if there is one (take its
 * place), else the column (go to its end). Falls back to nearest corners when
 * the pointer is between columns.
 */
export const boardCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const typeOf = (id: string | number) =>
    args.droppableContainers.find((c) => c.id === id)?.data.current?.type;
  const card = hits.find((h) => typeOf(h.id) === 'card' && h.id !== args.active.id);
  if (card) return [card];
  const column = hits.find((h) => typeOf(h.id) === 'column');
  return column ? [column] : closestCorners(args);
};

export interface BoardStatus {
  id: string;
  name: string;
  color: string;
  category: string;
}

interface BoardProps {
  projectId: string;
  statuses: BoardStatus[];
  filter: TaskFilter;
  canCreate: boolean;
  canMove: boolean;
  onOpen: (taskId: string) => void;
}

/**
 * Kanban board. Each column pages its own tasks. A drop updates the cached
 * columns at once (optimistic), then calls moveTask with the neighbours; the
 * server picks the fractional rank. On error the board refetches.
 */
export function Board({ projectId, statuses, filter, canCreate, canMove, onOpen }: BoardProps) {
  const qc = useQueryClient();
  const { move } = useTaskMutations(projectId);
  const [dragging, setDragging] = useState<Card | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const columnKey = (statusId: string) => boardKeys.column(projectId, statusId, filter);

  const onDragStart = ({ active }: DragStartEvent) =>
    setDragging((active.data.current?.card as Card) ?? null);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const card = active.data.current?.card as Card | undefined;
    const fromStatus = active.data.current?.statusId as string | undefined;
    const toStatus = over.data.current?.statusId as string | undefined;
    if (!card || !fromStatus || !toStatus) return;
    const overId = over.data.current?.type === 'card' ? String(over.id) : null;
    const same = fromStatus === toStatus;
    const source = cardsOf(qc.getQueryData<ColumnData>(columnKey(fromStatus)));
    const target = same ? source : cardsOf(qc.getQueryData<ColumnData>(columnKey(toStatus)));
    const plan = planMove(card, source, target, overId, same);
    if (!plan) return;

    // Optimistic: show the card in its new place now.
    void qc.cancelQueries({ queryKey: boardKeys.all(projectId) });
    if (!same) qc.setQueryData<ColumnData>(columnKey(fromStatus), (d) => withoutCard(d, card.id));
    qc.setQueryData<ColumnData>(columnKey(toStatus), (d) => withOrder(d, plan.order));

    move.mutate(
      {
        id: card.id,
        statusId: toStatus,
        afterTaskId: plan.afterTaskId,
        beforeTaskId: plan.afterTaskId ? null : plan.beforeTaskId,
      },
      { onError: (err) => toast.error(`Couldn't move ${card.key}: ${errorMessage(err)}`) },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8"
        role="list"
        aria-label="Board"
      >
        {statuses.map((s) => (
          <Column
            key={s.id}
            projectId={projectId}
            status={s}
            filter={filter}
            canCreate={canCreate}
            canMove={canMove}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {dragging && (
          <div className="w-72 rotate-2 cursor-grabbing rounded-lg border border-brand-300 bg-card p-3 shadow-lg">
            <CardBody card={dragging} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
