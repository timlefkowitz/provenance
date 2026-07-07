import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNextDefaultGoalState,
  calculateNextGoalStreakState,
  getStarTier,
  type UserGoalRecord,
} from './streak-service';

function baseGoal(overrides: Partial<UserGoalRecord> = {}): UserGoalRecord {
  return {
    id: 'goal-1',
    user_id: 'user-1',
    title: 'Working on my art',
    emoji: '🎨',
    is_default: true,
    is_archived: false,
    current_streak_days: 0,
    longest_streak_days: 0,
    last_checkin_date: null,
    daily_upload_count: 0,
    daily_upload_date: null,
    has_daily_upload_bonus: false,
    star_tier: 'bronze',
    daily_favorite_count: 0,
    daily_favorite_date: null,
    has_daily_favorite_bonus: false,
    ...overrides,
  };
}

test('increments streak for consecutive-day daily activity', () => {
  const next = calculateNextDefaultGoalState(
    baseGoal({
      current_streak_days: 2,
      longest_streak_days: 3,
      last_checkin_date: '2026-03-19',
    }),
    'daily_activity',
    new Date('2026-03-20T10:00:00.000Z'),
  );

  assert.equal(next.current_streak_days, 3);
  assert.equal(next.longest_streak_days, 3);
  assert.equal(next.star_tier, 'bronze');
});

test('resets streak after missing a day', () => {
  const next = calculateNextDefaultGoalState(
    baseGoal({
      current_streak_days: 6,
      longest_streak_days: 8,
      last_checkin_date: '2026-03-17',
    }),
    'daily_activity',
    new Date('2026-03-20T10:00:00.000Z'),
  );

  assert.equal(next.current_streak_days, 1);
  assert.equal(next.longest_streak_days, 8);
  assert.equal(next.star_tier, 'bronze');
});

test('keeps daily activity idempotent on same day', () => {
  const next = calculateNextDefaultGoalState(
    baseGoal({
      current_streak_days: 4,
      longest_streak_days: 4,
      last_checkin_date: '2026-03-20',
    }),
    'daily_activity',
    new Date('2026-03-20T18:00:00.000Z'),
  );

  assert.equal(next.current_streak_days, 4);
  assert.equal(next.longest_streak_days, 4);
});

test('applies one-time upload bonus at three uploads', () => {
  const next = calculateNextDefaultGoalState(
    baseGoal({
      current_streak_days: 2,
      longest_streak_days: 2,
      last_checkin_date: '2026-03-20',
      daily_upload_count: 2,
      daily_upload_date: '2026-03-20',
      has_daily_upload_bonus: false,
    }),
    'artwork_uploaded',
    new Date('2026-03-20T18:00:00.000Z'),
  );

  assert.equal(next.daily_upload_count, 3);
  assert.equal(next.has_daily_upload_bonus, true);
  assert.equal(next.current_streak_days, 3);
});

test('applies one-time favorite bonus at five favorites', () => {
  const next = calculateNextDefaultGoalState(
    baseGoal({
      current_streak_days: 1,
      longest_streak_days: 1,
      last_checkin_date: '2026-03-20',
      daily_favorite_count: 4,
      daily_favorite_date: '2026-03-20',
      has_daily_favorite_bonus: false,
    }),
    'artwork_favorited',
    new Date('2026-03-20T18:00:00.000Z'),
  );

  assert.equal(next.daily_favorite_count, 5);
  assert.equal(next.has_daily_favorite_bonus, true);
  assert.equal(next.current_streak_days, 2);
});

test('maps star tiers at boundaries', () => {
  assert.equal(getStarTier(1), 'bronze');
  assert.equal(getStarTier(4), 'silver');
  assert.equal(getStarTier(8), 'gold');
});

test('generic goal streak logic mirrors default goal day handling', () => {
  const next = calculateNextGoalStreakState(
    { current_streak_days: 1, longest_streak_days: 2, last_checkin_date: '2026-03-19' },
    new Date('2026-03-20T10:00:00.000Z'),
  );

  assert.equal(next.current_streak_days, 2);
  assert.equal(next.longest_streak_days, 2);
  assert.equal(next.last_checkin_date, '2026-03-20');
});
