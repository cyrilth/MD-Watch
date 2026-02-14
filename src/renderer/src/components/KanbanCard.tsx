import { useDraggable } from '@dnd-kit/core'
import type { KanbanCard as KanbanCardType } from '@/kanban/parser'

type KanbanCardProps = {
  card: KanbanCardType
}

export function KanbanCard({ card }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  })

  return (
    <div
      ref={setNodeRef}
      className={`kanban-card ${isDragging ? 'kanban-card-dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      {card.text}
    </div>
  )
}
