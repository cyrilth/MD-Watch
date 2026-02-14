/**
 * Kanban parser (2.2): split selected text by any heading line (#, ##, ###, …) → columns;
 * within each block parse - / * list items → cards.
 */

export type KanbanCard = { id: string; text: string }
export type KanbanColumn = { id: string; title: string; cards: KanbanCard[] }
export type ParsedKanban = { columns: KanbanColumn[] }

/** Matches line start with one or more # and optional space (any heading level). */
const HEADING_LINE = /^#+\s*/m
/** Matches a list item: optional indent, - or *, then space, then rest of line. */
const LIST_ITEM = /^\s*[-*]\s+(.*)$/gm

/**
 * Parse the selected region of the document into kanban columns and cards.
 * Returns null if selection is empty or no columns are found.
 */
export function parseKanbanSelection(
  fullContent: string,
  region: { start: number; end: number }
): ParsedKanban | null {
  const selected = fullContent.slice(region.start, region.end)
  const trimmed = selected.trim()
  if (!trimmed) return null

  const parts = selected.split(HEADING_LINE)
  const columns: KanbanColumn[] = []

  for (let i = 0; i < parts.length; i++) {
    const block = parts[i].trim()
    if (!block) continue

    const colIndex = columns.length
    let title: string
    let cards: KanbanCard[]

    if (i === 0) {
      title = 'Untitled'
      cards = parseListItems(block)
    } else {
      const firstNewline = block.indexOf('\n')
      const titleLine = firstNewline >= 0 ? block.slice(0, firstNewline) : block
      title = titleLine.trim() || 'Untitled'
      const body = firstNewline >= 0 ? block.slice(firstNewline + 1) : ''
      cards = parseListItems(body)
    }
    cards.forEach((c, idx) => {
      c.id = `col-${colIndex}-card-${idx}`
    })
    columns.push({ id: `col-${colIndex}`, title, cards })
  }

  if (columns.length === 0) return null
  return { columns }
}

function parseListItems(block: string): KanbanCard[] {
  const cards: KanbanCard[] = []
  LIST_ITEM.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LIST_ITEM.exec(block)) !== null) {
    const text = match[1].trim()
    cards.push({ id: '', text })
  }
  return cards
}

/** Serialize parsed kanban back to markdown (for 2.6: after moving cards). */
export function kanbanToMarkdown(parsed: ParsedKanban): string {
  return parsed.columns
    .map((col) => {
      const heading = col.title === 'Untitled' ? '## Untitled' : `## ${col.title}`
      const items = col.cards.map((c) => `- ${c.text}`).join('\n')
      return items ? `${heading}\n${items}` : heading
    })
    .join('\n\n')
}
