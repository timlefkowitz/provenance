import type { UniqueIdentifier } from '@dnd-kit/core';

export type KanbanAccessibilityLead = { id: string; name: string; stage: string };

// Screen reader text for the leads board. Drop targets are either a column (a stage id)
// or another card (its stage is used), so both are resolved to a stage label.
export function buildLeadKanbanAccessibility(
  leads: KanbanAccessibilityLead[],
  stageLabels: Record<string, string>,
) {
  const leadById = (id: UniqueIdentifier) => leads.find((l) => l.id === String(id));
  const nameOf = (id: UniqueIdentifier) => leadById(id)?.name ?? 'contact';
  const stageOf = (id: UniqueIdentifier) =>
    stageLabels[String(id)] !== undefined ? String(id) : leadById(id)?.stage;
  const labelOf = (id: UniqueIdentifier) => {
    const stage = stageOf(id);
    return stage ? (stageLabels[stage] ?? stage) : 'an unknown stage';
  };

  return {
    announcements: {
      onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) =>
        `Picked up ${nameOf(active.id)}. Use the arrow keys to choose a stage, then press space to drop.`,
      onDragOver: ({ active, over }: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) =>
        over ? `${nameOf(active.id)} is over ${labelOf(over.id)}.` : `${nameOf(active.id)} is not over a stage.`,
      onDragEnd: ({ active, over }: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) => {
        if (!over) return `Dropped ${nameOf(active.id)} without moving it.`;
        const lead = leadById(active.id);
        if (lead && stageOf(over.id) === lead.stage) return `Dropped ${lead.name} back in ${labelOf(over.id)}.`;
        return `Moved ${nameOf(active.id)} to ${labelOf(over.id)}`;
      },
      onDragCancel: ({ active }: { active: { id: UniqueIdentifier } }) => `Cancelled moving ${nameOf(active.id)}.`,
    },
    screenReaderInstructions: {
      draggable:
        'To move a contact, press space or enter to pick it up, use the arrow keys to move it to another stage, then press space or enter to drop it. Press escape to cancel.',
    },
  };
}
