import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUSTRIAN_LEGAL_BREAK_THRESHOLD_MINUTES,
  calculateActualBreakMinutes,
  calculateBookedBreakMinutes,
  getRequiredBreakMinutes,
} from './time-tracking.logic.js';

test('legal minimum break in Austria applies only above 6 hours', () => {
  assert.equal(getRequiredBreakMinutes(AUSTRIAN_LEGAL_BREAK_THRESHOLD_MINUTES), 0);
  assert.equal(getRequiredBreakMinutes(AUSTRIAN_LEGAL_BREAK_THRESHOLD_MINUTES + 1), 30);
});

test('booked break uses legal minimum when actual break is shorter', () => {
  assert.equal(calculateBookedBreakMinutes(7 * 60, 20), 30);
});

test('booked break keeps exact actual break when it exceeds the minimum', () => {
  assert.equal(calculateBookedBreakMinutes(7 * 60, 42), 42);
});

test('company policy can be stricter than the legal minimum', () => {
  assert.equal(
    calculateBookedBreakMinutes(5.5 * 60, 20, {
      companyThresholdMinutes: 300,
      companyMinBreakMinutes: 45,
    }),
    45,
  );
});

test('actual break minutes include running breaks up to current time', () => {
  const startedAt = new Date('2026-04-08T10:00:00.000Z');
  const endedAt = new Date('2026-04-08T10:15:00.000Z');
  const runningStart = new Date('2026-04-08T11:00:00.000Z');
  const asOf = new Date('2026-04-08T11:07:00.000Z');

  assert.equal(
    calculateActualBreakMinutes([
      { startedAt, endedAt },
      { startedAt: runningStart, endedAt: null },
    ], asOf),
    22,
  );
});
