import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { ParsedKanban } from '@/kanban/parser'
import { KanbanColumn } from '@/components/KanbanColumn'

type KanbanBoardProps = {
  state: ParsedKanban
  onKanbanChange: (next: ParsedKanban) => void
}

/** Renders columns as lanes and cards as draggable items (2.5). */
export function KanbanBoard({ state, onKanbanChange }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    // activeId is card id "col-0-card-1"; overId can be column id "col-0" or card id
    const cardMatch = activeId.match(/^col-(\d+)-card-(\d+)$/)
    if (!cardMatch) return
    const fromColIndex = parseInt(cardMatch[1], 10)
    const fromCardIndex = parseInt(cardMatch[2], 10)

    let toColIndex: number
    let toCardIndex: number
    const overColMatch = overId.match(/^col-(\d+)$/)
    const overCardMatch = overId.match(/^col-(\d+)-card-(\d+)$/)
    if (overColMatch) {
      toColIndex = parseInt(overColMatch[1], 10)
      toCardIndex = 0
    } else if (overCardMatch) {
      toColIndex = parseInt(overCardMatch[1], 10)
      toCardIndex = parseInt(overCardMatch[2], 10) + 1
    } else {
      return
    }

    const columns = state.columns.map((col) => ({
      ...col,
      cards: [...col.cards],
    }))
    const [movedCard] = columns[fromColIndex].cards.splice(fromCardIndex, 1)
    if (!movedCard) return
    let insertIndex = toCardIndex
    if (fromColIndex === toColIndex && fromCardIndex < toCardIndex) insertIndex -= 1
    columns[toColIndex].cards.splice(insertIndex, 0, movedCard)
    onKanbanChange({ columns })
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {state.columns.map((col) => (
          <KanbanColumn key={col.id} column={col} />
        ))}
      </div>
    </DndContext>
  )
}
