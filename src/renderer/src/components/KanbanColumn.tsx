import { useDroppable } from '@dnd-kit/core'
import type { KanbanColumn as KanbanColumnType } from '@/kanban/parser'
import { KanbanCard } from '@/components/KanbanCard'

type KanbanColumnProps = {
  column: KanbanColumnType
}

export function KanbanColumn({ column }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  })

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'kanban-column-over' : ''}`}
    >
      <div className="kanban-column-title">{column.title}</div>
      <div className="kanban-column-cards">
        {column.cards.map((card) => (
          <KanbanCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
