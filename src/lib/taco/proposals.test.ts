import { describe, expect, it } from 'vitest';

import {
  applyEditsToPayload,
  cleanAppend,
  cleanCreateRows,
  cleanLines,
  cleanSet,
  yearToDate,
  type ProposalPayload,
  type ProposalPreview,
} from './proposals';

const ID = '11111111-1111-4111-8111-111111111111';

describe('sanitizers', () => {
  it('cleanLines splits, trims and de-dupes case-insensitively', () => {
    expect(cleanLines('Jane Doe\n  \njane doe\nJohn Roe')).toEqual(['Jane Doe', 'John Roe']);
    expect(cleanLines(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
    expect(cleanLines(42)).toEqual([]);
  });

  it('cleanSet only keeps known fields', () => {
    expect(cleanSet({ medium: ' oil ', account_id: 'evil', title: '' })).toEqual({ medium: 'oil' });
  });

  it('cleanAppend only keeps known history fields', () => {
    expect(cleanAppend({ formerOwners: ['A'], owned_by: ['B'] })).toEqual({ formerOwners: ['A'] });
  });

  it('cleanCreateRows needs a title and ignores bad attachment ids', () => {
    const rows = cleanCreateRows([{ title: 'One', attachment_id: 'not-a-uuid' }, { artist_name: 'x' }, { title: 'Two', attachment_id: ID }]);
    expect(rows.map((r) => r.title)).toEqual(['One', 'Two']);
    expect(rows[0]?.attachment_id).toBeNull();
    expect(rows[1]?.attachment_id).toBe(ID);
  });

  it('yearToDate', () => {
    expect(yearToDate('2004')).toBe('2004-01-01');
    expect(yearToDate('c. 1968')).toBe('1968-01-01');
    expect(yearToDate('2004-05')).toBe('2004-05-01');
    expect(yearToDate('2004-05-03')).toBe('2004-05-03');
    expect(yearToDate('undated')).toBeNull();
  });
});

describe('applyEditsToPayload', () => {
  const preview: ProposalPreview = {
    title: 't',
    summary: '',
    changes: [
      { key: 'set.medium', label: 'Medium', before: null, after: 'oil', editable: true },
      { key: 'append.formerOwners', label: 'Owners', before: null, after: 'A', editable: true },
      { key: 'set.title', label: 'Title', before: null, after: 'X', editable: false },
    ],
    apply_label: 'Apply',
  };
  const payload: ProposalPayload = {
    kind: 'update_provenance',
    artwork_id: ID,
    set: { medium: 'oil', title: 'X' },
    append: { formerOwners: ['A'] },
  };

  it('applies editable fields only', () => {
    const out = applyEditsToPayload(payload, preview, {
      fields: { 'set.medium': 'acrylic', 'append.formerOwners': 'A\nB', 'set.title': 'Hacked' },
    });
    expect(out).toMatchObject({ set: { medium: 'acrylic', title: 'X' }, append: { formerOwners: ['A', 'B'] } });
  });

  it('clearing a field drops it', () => {
    const out = applyEditsToPayload(payload, preview, { fields: { 'set.medium': '  ' } });
    expect(out.kind === 'update_provenance' && out.set.medium).toBeUndefined();
  });

  it('filters and renames create rows', () => {
    const create: ProposalPayload = { kind: 'create_artworks', rows: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] };
    const out = applyEditsToPayload(create, { ...preview, changes: [] }, { selectedRows: [0, 2], rowTitles: { 2: 'C2' } });
    expect(out.kind === 'create_artworks' && out.rows.map((r) => r.title)).toEqual(['A', 'C2']);
  });

  it('does not touch the target artwork id', () => {
    const out = applyEditsToPayload(payload, preview, { fields: { artwork_id: 'other' } as Record<string, string> });
    expect(out.kind === 'update_provenance' && out.artwork_id).toBe(ID);
  });
});
