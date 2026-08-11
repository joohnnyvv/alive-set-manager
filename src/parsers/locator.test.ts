import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocator, isChordProgression } from './locator.js';

describe('Locator Parser', () => {

  test('extracts song and section boundaries with descriptions', () => {
    const loc1 = parseLocator('Song Alpha {Tuning: E}', 0);
    assert.equal(loc1.type, 'song');
    assert.equal(loc1.name, 'Song Alpha');
    assert.equal(loc1.description, 'Tuning: E');

    const loc2 = parseLocator('> Intro +LOOP', 16);
    assert.equal(loc2.type, 'section');
    assert.equal(loc2.name, 'Intro');
    assert.equal(loc2.flags.loop, true);

    const loc3 = parseLocator('>> Chorus', 32);
    assert.equal(loc3.type, 'section');
    assert.equal(loc3.name, 'Chorus');
    assert.equal(loc3.flags.quickJump, true);
  });

  test('parses locator flags correctly', () => {
    const p1 = parseLocator('> Verse +PAUSE', 0);
    assert.equal(p1.flags.pause, true);

    const p2 = parseLocator('> Hook +LOOP:4', 0);
    assert.equal(p2.flags.loop, true);
    assert.equal(p2.flags.loopCount, 4);

    const p3 = parseLocator('> Solo +LOOPFULL', 0);
    assert.equal(p3.flags.loop, true);
    assert.equal(p3.flags.loopFull, true);

    const p4 = parseLocator('> Bridge +SKIP', 0);
    assert.equal(p4.flags.skip, true);

    const p5 = parseLocator('> Outro +END', 0);
    assert.equal(p5.flags.end, true);

    const p6 = parseLocator('Interlude [nosong]', 0);
    assert.equal(p6.flags.nosong, true);
  });

  test('extracts target tempo from tags and descriptions', () => {
    const loc1 = parseLocator('Upbeat Song #140bpm', 0);
    assert.equal(loc1.targetTempo, 140);

    const loc2 = parseLocator('Slow Ballad {bpm: 80}', 64);
    assert.equal(loc2.targetTempo, 80);

    const loc3 = parseLocator('Dance Track [128bpm]', 128);
    assert.equal(loc3.targetTempo, 128);
  });

  test('extracts chord progressions from various syntaxes', () => {
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

  test('identifies chord progression strings with isChordProgression', () => {
    assert.equal(isChordProgression('C G Am F'), true);
    assert.equal(isChordProgression('C#m7 F#7 Bmaj7 E'), true);
    assert.equal(isChordProgression('Guitar Solo'), false);
    assert.equal(isChordProgression('chords: Dm G C'), true);
  });

  test('extracts color, duration overrides, and transition targets', () => {
    const loc = parseLocator('Song [blue] [2:30] >>> NextSection', 0);
    assert.equal(loc.color, 'blue');
    assert.equal(loc.duration, 150);
    assert.equal(loc.transitionTarget, 'NextSection');
  });

});
