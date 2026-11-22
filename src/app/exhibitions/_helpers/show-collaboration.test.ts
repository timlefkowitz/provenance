import { describe, expect, it } from 'vitest';
import {
  canArtistEditField,
  invitedWorkGoesStraightIn,
  normalizeShowFieldValue,
  parseFieldSources,
  parsePlannedPieceCount,
  planApprovedChange,
  planArtistShowEdit,
  sourcesAfterOrganiserEdit,
  sourcesForOrganiserValues,
} from './show-collaboration';

describe('sourcesForOrganiserValues', () => {
  it('marks only the fields the organiser filled', () => {
    expect(
      sourcesForOrganiserValues({
        title: 'Spring',
        description: '  ',
        start_date: '2027-03-01',
        location: null,
      }),
    ).toEqual({ title: 'gallery', start_date: 'gallery' });
  });
});

describe('parseFieldSources', () => {
  it('drops unknown fields and values', () => {
    expect(parseFieldSources({ title: 'gallery', foo: 'artist', description: 'x' })).toEqual({
      title: 'gallery',
    });
    expect(parseFieldSources(null)).toEqual({});
    expect(parseFieldSources(['title'])).toEqual({});
  });
});

describe('canArtistEditField', () => {
  it('locks organiser fields and needs show-edit rights', () => {
    const fieldSources = { title: 'gallery' as const, description: 'artist' as const };
    expect(canArtistEditField({ canEditShow: true, fieldSources, field: 'title' })).toBe(false);
    expect(canArtistEditField({ canEditShow: true, fieldSources, field: 'description' })).toBe(true);
    expect(canArtistEditField({ canEditShow: true, fieldSources, field: 'location' })).toBe(true);
    expect(canArtistEditField({ canEditShow: false, fieldSources, field: 'location' })).toBe(false);
  });
});

describe('planArtistShowEdit', () => {
  const current = { title: 'Untitled solo show', start_date: '2027-03-01', description: null };

  it('writes open fields and marks them as the artist’s', () => {
    const plan = planArtistShowEdit({
      canEditShow: true,
      fieldSources: { start_date: 'gallery' },
      current,
      patch: { title: 'Salt Lines', description: 'New paintings' },
    });
    expect(plan).toEqual({
      ok: true,
      updates: { title: 'Salt Lines', description: 'New paintings' },
      fieldSources: { start_date: 'gallery', title: 'artist', description: 'artist' },
      changed: ['title', 'description'],
    });
  });

  it('rejects edits to organiser fields', () => {
    const plan = planArtistShowEdit({
      canEditShow: true,
      fieldSources: { start_date: 'gallery' },
      current,
      patch: { start_date: '2027-04-01' },
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.lockedFields).toEqual(['start_date']);
  });

  it('ignores unchanged organiser fields sent back with the form', () => {
    const plan = planArtistShowEdit({
      canEditShow: true,
      fieldSources: { start_date: 'gallery' },
      current,
      patch: { start_date: '2027-03-01', location: 'Room 2' },
    });
    expect(plan.ok && plan.changed).toEqual(['location']);
  });

  it('refuses artists who may not edit the show', () => {
    expect(
      planArtistShowEdit({ canEditShow: false, fieldSources: {}, current, patch: { location: 'x' } })
        .ok,
    ).toBe(false);
  });

  it('checks date order and required fields', () => {
    expect(
      planArtistShowEdit({ canEditShow: true, fieldSources: {}, current, patch: { end_date: '2027-02-01' } })
        .ok,
    ).toBe(false);
    expect(
      planArtistShowEdit({ canEditShow: true, fieldSources: {}, current, patch: { title: ' ' } }).ok,
    ).toBe(false);
  });

  it('clearing an artist field drops its source', () => {
    const plan = planArtistShowEdit({
      canEditShow: true,
      fieldSources: { location: 'artist' },
      current: { ...current, location: 'Room 2' },
      patch: { location: '' },
    });
    expect(plan.ok && plan.fieldSources).toEqual({});
    expect(plan.ok && plan.updates).toEqual({ location: null });
  });
});

describe('planApprovedChange', () => {
  it('applies the value and keeps the field the organiser’s', () => {
    expect(
      planApprovedChange({
        field: 'title',
        proposed: 'Salt Lines',
        current: { title: 'Spring' },
        fieldSources: { title: 'gallery' },
      }),
    ).toEqual({ ok: true, updates: { title: 'Salt Lines' }, fieldSources: { title: 'gallery' } });
  });

  it('rejects a date that would end before the show opens', () => {
    expect(
      planApprovedChange({
        field: 'start_date',
        proposed: '2027-05-01',
        current: { start_date: '2027-03-01', end_date: '2027-04-01' },
        fieldSources: {},
      }).ok,
    ).toBe(false);
  });
});

describe('normalizeShowFieldValue', () => {
  it('validates dates and links', () => {
    expect(normalizeShowFieldValue('start_date', '2027-02-30').ok).toBe(false);
    expect(normalizeShowFieldValue('end_date', '')).toEqual({ ok: true, value: null });
    expect(normalizeShowFieldValue('image_url', 'http://x.com/a.jpg').ok).toBe(false);
    expect(normalizeShowFieldValue('image_url', 'https://x.com/a.jpg').ok).toBe(true);
  });
});

describe('invitedWorkGoesStraightIn', () => {
  it('only for organiser invites to solo and group shows', () => {
    expect(invitedWorkGoesStraightIn('solo', 'invite')).toBe(true);
    expect(invitedWorkGoesStraightIn('group', 'invite')).toBe(true);
    expect(invitedWorkGoesStraightIn('open_call', 'invite')).toBe(false);
    expect(invitedWorkGoesStraightIn('group', 'open_call')).toBe(false);
    expect(invitedWorkGoesStraightIn(null, 'invite')).toBe(false);
  });
});

describe('sourcesAfterOrganiserEdit', () => {
  it('claims changed fields and keeps the rest', () => {
    expect(
      sourcesAfterOrganiserEdit(
        { description: 'artist', title: 'artist' },
        { title: 'A', description: 'B', location: null },
        { title: 'A', description: 'C', location: '' },
      ),
    ).toEqual({ title: 'artist', description: 'gallery' });
  });
});

describe('parsePlannedPieceCount', () => {
  it('accepts whole numbers in range', () => {
    expect(parsePlannedPieceCount('')).toBeNull();
    expect(parsePlannedPieceCount('12')).toBe(12);
    expect(parsePlannedPieceCount('1.5')).toBe('invalid');
    expect(parsePlannedPieceCount(-1)).toBe('invalid');
  });
});
