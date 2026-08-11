import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, beatsToSeconds, formatClockTime } from './formatTime.js';

describe('Frontend Time Formatting Utilities', () => {

  test('formatDuration formats seconds into mm:ss', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(65), '1:05');
    assert.equal(formatDuration(215), '3:35');
    assert.equal(formatDuration(3600), '60:00');
    assert.equal(formatDuration(-1), '0:00');
  });

  test('beatsToSeconds calculates accurate seconds from beats and tempo', () => {
    assert.equal(beatsToSeconds(120, 120), 60);
    assert.equal(beatsToSeconds(0, 120), 0);
    assert.equal(beatsToSeconds(240, 120), 120);
    assert.equal(beatsToSeconds(100, 0), 0);
  });

  test('formatClockTime formats 24h and 12h clock correctly', () => {
    const d = new Date(2026, 0, 1, 14, 5, 9);
    assert.equal(formatClockTime(d, true), '14:05:09');
    assert.equal(formatClockTime(d, false), '2:05:09 PM');
  });

});
