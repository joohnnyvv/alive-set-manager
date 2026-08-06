import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocator } from '../src/parsers/locator.js';
import { SetlistEngine } from '../src/engine/setlist.js';

describe('Section Chord Progressions', () => {

  test('1. parseLocator extracts chords from various syntaxes', () => {
    // Syntax 1: {chords: C - G - Am - F}
    const loc1 = parseLocator('> Chorus {chords: C - G - Am - F}', 16);
    assert.equal(loc1.type, 'section');
    assert.equal(loc1.name, 'Chorus');
    assert.equal(loc1.chords, 'C - G - Am - F');

    // Syntax 2: {c: C G Am F}
    const loc2 = parseLocator('> Verse {c: C G Am F}', 32);
    assert.equal(loc2.type, 'section');
    assert.equal(loc2.name, 'Verse');
    assert.equal(loc2.chords, 'C G Am F');

    // Syntax 3: [chords: Em D C G]
    const loc3 = parseLocator('> Bridge [chords: Em D C G]', 48);
    assert.equal(loc3.type, 'section');
    assert.equal(loc3.name, 'Bridge');
    assert.equal(loc3.chords, 'Em D C G');

    // Syntax 4: Automatic chord detection in curly braces {Am F C G}
    const loc4 = parseLocator('> Outro {Am F C G}', 64);
    assert.equal(loc4.type, 'section');
    assert.equal(loc4.name, 'Outro');
    assert.equal(loc4.chords, 'Am F C G');

    // Syntax 5: Inline c: C G Am F
    const loc5 = parseLocator('> Solo c: C G Am F', 80);
    assert.equal(loc5.type, 'section');
    assert.equal(loc5.name, 'Solo');
    assert.equal(loc5.chords, 'C G Am F');

    // Syntax 6: Pipe syntax | C G Am F |
    const loc6 = parseLocator('> Intro | C G Am F |', 0);
    assert.equal(loc6.type, 'section');
    assert.equal(loc6.name, 'Intro');
    assert.equal(loc6.chords, 'C G Am F');
  });

  test('2. Setlist Engine builds sections with chord progressions attached', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song Alpha', time: 0 },
      { id: 'c2', name: '> Verse {c: C G Am F}', time: 16 },
      { id: 'c3', name: '> Chorus {chords: F G C}', time: 32 },
    ];

    const state = engine.buildSetlistFromCues(cues);
    assert.equal(state.songs.length, 1);
    const song = state.songs[0];
    assert.equal(song.sections.length, 2);
    assert.equal(song.sections[0].name, 'Verse');
    assert.equal(song.sections[0].chords, 'C G Am F');
    assert.equal(song.sections[1].name, 'Chorus');
    assert.equal(song.sections[1].chords, 'F G C');
  });

  test('3. updateSectionChords updates section chord progression dynamically', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song Alpha', time: 0 },
      { id: 'c2', name: '> Verse', time: 16 },
    ];

    engine.buildSetlistFromCues(cues);
    engine.updateSectionChords('c2', 'Em C G D');

    const sec = engine.getSectionById('c2');
    assert.ok(sec);
    assert.equal(sec.section.chords, 'Em C G D');
  });
});
