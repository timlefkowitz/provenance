import { describe, expect, it } from 'vitest';
import { buildLeadKanbanAccessibility } from './lead-kanban-accessibility';

const leads = [
  { id: 'lead-1', name: 'Jane Doe', stage: 'new' },
  { id: 'lead-2', name: 'Sam Lee', stage: 'contacted' },
];
const stageLabels = { new: 'New', contacted: 'Contacted' };
const { announcements, screenReaderInstructions } = buildLeadKanbanAccessibility(leads, stageLabels);

describe('buildLeadKanbanAccessibility', () => {
  it('names the lead and the stage when a card is dropped on a column', () => {
    expect(announcements.onDragEnd({ active: { id: 'lead-1' }, over: { id: 'contacted' } })).toBe(
      'Moved Jane Doe to Contacted',
    );
  });

  it('names the stage of the card a lead is dropped onto', () => {
    expect(announcements.onDragEnd({ active: { id: 'lead-1' }, over: { id: 'lead-2' } })).toBe(
      'Moved Jane Doe to Contacted',
    );
  });

  it('announces pickup, movement over a column and a cancelled drag', () => {
    expect(announcements.onDragStart({ active: { id: 'lead-1' } })).toMatch(/^Picked up Jane Doe\./);
    expect(announcements.onDragOver({ active: { id: 'lead-1' }, over: { id: 'contacted' } })).toBe(
      'Jane Doe is over Contacted.',
    );
    expect(announcements.onDragCancel({ active: { id: 'lead-1' } })).toBe('Cancelled moving Jane Doe.');
  });

  it('says so when a lead is dropped back in its own stage or outside any stage', () => {
    expect(announcements.onDragEnd({ active: { id: 'lead-1' }, over: { id: 'new' } })).toBe(
      'Dropped Jane Doe back in New.',
    );
    expect(announcements.onDragEnd({ active: { id: 'lead-1' }, over: null })).toBe(
      'Dropped Jane Doe without moving it.',
    );
  });

  it('provides keyboard instructions for dragging', () => {
    expect(screenReaderInstructions.draggable).toMatch(/arrow keys/);
  });
});
