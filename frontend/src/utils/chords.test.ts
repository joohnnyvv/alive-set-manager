import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseChordTokens } from './chords.js';

describe('Frontend Chord Utilities', () => {

  test('parseChordTokens splits various delimiters into clean tokens', () => {
    assert.deepEqual(parseChordTokens('C - G - Am - F'), ['C', 'G', 'Am', 'F']);
    assert.deepEqual(parseChordTokens('C G Am F'), ['C', 'G', 'Am', 'F']);
    assert.deepEqual(parseChordTokens('Em, D, C, G'), ['Em', 'D', 'C', 'G']);
    assert.deepEqual(parseChordTokens('| Dm | G7 | Cmaj7 |'), ['Dm', 'G7', 'Cmaj7']);
    assert.deepEqual(parseChordTokens(''), []);
  });

});
