import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getCssColor, colorMap } from './colors.js';

describe('Frontend Color Utilities', () => {

  test('getCssColor returns correct hex value for named colors', () => {
    assert.equal(getCssColor('red'), '#ff5252');
    assert.equal(getCssColor('blue'), '#3f51b5');
    assert.equal(getCssColor('GREEN'), '#4caf50');
    assert.equal(getCssColor(''), 'var(--accent)');
    assert.equal(getCssColor(undefined), 'var(--accent)');
  });

  test('colorMap includes common Ableton colors', () => {
    assert.ok(colorMap.red);
    assert.ok(colorMap.orange);
    assert.ok(colorMap.yellow);
    assert.ok(colorMap.green);
    assert.ok(colorMap.blue);
    assert.ok(colorMap.purple);
  });

});
