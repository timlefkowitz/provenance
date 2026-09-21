import { describe, expect, it } from 'vitest';
import type { ArtistLead } from '~/app/portal/or/_actions/leads-constants';
import { ALL_SOURCES, NO_SOURCE, filterAndSortContacts, sourceOptions } from './contact-view';

const lead = (name: string | null, source: string | null, email: string | null = null): ArtistLead =>
  ({
    id: `${name}-${source}`,
    artist_user_id: 'u',
    contact_name: name,
    contact_email: email,
    contact_phone: null,
    notes: null,
    is_lead: false,
    stage: 'interested',
    artwork_id: null,
    estimated_value: null,
    follow_up_date: null,
    source,
    created_at: '',
    updated_at: '',
  }) as ArtistLead;

const contacts = [
  lead('Zed', 'sale'),
  lead('Amy', 'certificate'),
  lead('Bob', 'sale'),
  lead('Cy', null),
  lead('Dee', 'site_inquiry'),
  lead(null, null), // no name or email: not shown
];

const base = { query: '', source: ALL_SOURCES, sortKey: 'name', sortDir: 'asc' } as const;

describe('sourceOptions', () => {
  it('counts visible contacts per source, most common first, with friendly labels', () => {
    const opts = sourceOptions(contacts);
    expect(opts[0]).toEqual({ value: 'sale', label: 'Sale', count: 2 });
    expect(opts.find((o) => o.value === 'site_inquiry')?.label).toBe('Website Inquiry');
    expect(opts.find((o) => o.value === NO_SOURCE)).toEqual({ value: NO_SOURCE, label: 'Unknown', count: 1 });
    expect(opts.reduce((n, o) => n + o.count, 0)).toBe(5);
  });
});

describe('filterAndSortContacts', () => {
  it('filters to a single source', () => {
    const out = filterAndSortContacts(contacts, { ...base, source: 'sale' });
    expect(out.map((c) => c.contact_name)).toEqual(['Bob', 'Zed']);
  });

  it('filters to contacts with no source', () => {
    const out = filterAndSortContacts(contacts, { ...base, source: NO_SOURCE });
    expect(out.map((c) => c.contact_name)).toEqual(['Cy']);
  });

  it('sorts by source label then name, with unknown last in both directions', () => {
    const asc = filterAndSortContacts(contacts, { ...base, sortKey: 'source', sortDir: 'asc' });
    expect(asc.map((c) => c.contact_name)).toEqual(['Amy', 'Bob', 'Zed', 'Dee', 'Cy']);
    const desc = filterAndSortContacts(contacts, { ...base, sortKey: 'source', sortDir: 'desc' });
    expect(desc.map((c) => c.contact_name)).toEqual(['Dee', 'Bob', 'Zed', 'Amy', 'Cy']);
  });

  it('sorts by name descending and combines search with the source filter', () => {
    const out = filterAndSortContacts(contacts, { ...base, sortDir: 'desc' });
    expect(out[0].contact_name).toBe('Zed');
    const both = filterAndSortContacts(contacts, { ...base, source: 'sale', query: 'zed' });
    expect(both.map((c) => c.contact_name)).toEqual(['Zed']);
  });

  it('does not mutate its input', () => {
    const copy = [...contacts];
    filterAndSortContacts(contacts, { ...base, sortKey: 'source', sortDir: 'desc' });
    expect(contacts).toEqual(copy);
  });
});
