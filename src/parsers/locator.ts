import { ParsedLocator, LocatorFlags, LocatorType } from '../types/index.js';

/**
 * Parses AbleSet-style locator names into structured metadata.
 */
export function parseLocator(rawName: string, time: number): ParsedLocator {
  const trimmed = rawName.trim();

  // Ignored locators start with '*'
  if (trimmed.startsWith('*')) {
    return {
      rawName,
      type: 'ignored',
      name: trimmed.substring(1).trim(),
      time,
      tags: [],
      flags: createEmptyFlags(),
    };
  }

  let str = trimmed;

  let chords: string | undefined;

  // 1. Check for explicit chord bracket/brace syntax e.g. {chords: ...}, {c: ...}, [chords: ...], [c: ...]
  const chordBraceMatch = str.match(/[\{\[\(]\s*(?:chords?|ch|c)\s*:\s*([^}\]\)]+)[\}\]\)]/i);
  if (chordBraceMatch) {
    chords = chordBraceMatch[1].trim();
    str = str.replace(chordBraceMatch[0], '').trim();
  }

  // 2. Extract description inside {curly braces} if not consumed by explicit chords
  let description: string | undefined;
  const descMatch = str.match(/\{([^}]+)\}/);
  if (descMatch) {
    const content = descMatch[1].trim();
    if (/^(?:chords?|ch|c)\s*:/i.test(content)) {
      chords = content.replace(/^(?:chords?|ch|c)\s*:/i, '').trim();
    } else if (!chords && isChordProgression(content)) {
      chords = content;
    } else {
      description = content;
    }
    str = str.replace(/\{([^}]+)\}/, '').trim();
  }

  // 3. Check for pipe chord syntax e.g. | C G Am F |
  if (!chords) {
    const pipeMatch = str.match(/\|\s*([^|]+)\s*\|/);
    if (pipeMatch && isChordProgression(pipeMatch[1].trim())) {
      chords = pipeMatch[1].trim();
      str = str.replace(/\|\s*[^|]+\s*\|/, '').trim();
    }
  }

  // 4. Check for inline c: or chords: in locator name e.g. > Chorus c: C G Am F
  if (!chords) {
    const inlineMatch = str.match(/\b(?:chords?|ch|c)\s*:\s*(.+)$/i);
    if (inlineMatch) {
      chords = inlineMatch[1].trim();
      str = str.replace(/\b(?:chords?|ch|c)\s*:\s*.+$/i, '').trim();
    }
  }

  // Extract duration override inside [mm:ss] or [sec]
  let duration: number | undefined;
  const durMatch = str.match(/\[(\d+):(\d+)\]/);
  if (durMatch) {
    duration = parseInt(durMatch[1], 10) * 60 + parseInt(durMatch[2], 10);
    str = str.replace(/\[\d+:\d+\]/, '').trim();
  } else {
    const durSecMatch = str.match(/\[(\d+)s?\]/);
    if (durSecMatch && !isNaN(parseInt(durSecMatch[1], 10)) && !isColorName(durSecMatch[1])) {
      duration = parseInt(durSecMatch[1], 10);
      str = str.replace(/\[\d+s?\]/, '').trim();
    }
  }

  // Extract color override inside [color] (e.g., [blue], [red])
  let color: string | undefined;
  const colorMatch = str.match(/\[([a-zA-Z]+)\]/);
  if (colorMatch && colorMatch[1] !== 'nosong') {
    color = colorMatch[1].toLowerCase();
    str = str.replace(/\[[a-zA-Z]+\]/, '').trim();
  }

  // Extract transition target: >>> Target
  let transitionTarget: string | undefined;
  const transMatch = str.match(/>>>\s*(.+)/);
  if (transMatch) {
    transitionTarget = transMatch[1].trim();
    str = str.replace(/>>>\s*.+/, '').trim();
  }

  // Extract tags starting with #
  const tags: string[] = [];
  const tagMatches = str.match(/#[a-zA-Z0-9_-]+/g);
  if (tagMatches) {
    for (const tag of tagMatches) {
      tags.push(tag.substring(1));
    }
    str = str.replace(/#[a-zA-Z0-9_-]+/g, '').trim();
  }

  // Extract flags
  const flags = createEmptyFlags();

  if (/\+PAUSE\b/i.test(str)) {
    flags.pause = true;
    str = str.replace(/\+PAUSE\b/i, '').trim();
  }

  const loopCountMatch = str.match(/\+LOOP:(\d+)\b/i);
  if (loopCountMatch) {
    flags.loop = true;
    flags.loopCount = parseInt(loopCountMatch[1], 10);
    str = str.replace(/\+LOOP:\d+\b/i, '').trim();
  } else if (/\+LOOPFULL\b/i.test(str)) {
    flags.loop = true;
    flags.loopFull = true;
    str = str.replace(/\+LOOPFULL\b/i, '').trim();
  } else if (/\+LOOP\b/i.test(str)) {
    flags.loop = true;
    str = str.replace(/\+LOOP\b/i, '').trim();
  }

  if (/\+SKIP\b/i.test(str)) {
    flags.skip = true;
    str = str.replace(/\+SKIP\b/i, '').trim();
  }

  if (/\+END\b/i.test(str)) {
    flags.end = true;
    str = str.replace(/\+END\b/i, '').trim();
  }

  if (/\+JUMP\b/i.test(str)) {
    flags.jump = true;
    str = str.replace(/\+JUMP\b/i, '').trim();
  }

  if (/\+STAY\b/i.test(str)) {
    flags.stay = true;
    str = str.replace(/\+STAY\b/i, '').trim();
  }

  if (/\[nosong\]/i.test(str)) {
    flags.nosong = true;
    str = str.replace(/\[nosong\]/i, '').trim();
  }

  // Determine locator type and clean name
  let type: LocatorType = 'song';
  let name = str;

  const upper = str.toUpperCase();
  if (upper === 'SONG END') {
    type = 'song-end';
    name = 'SONG END';
  } else if (upper === 'STOP' || upper === 'AUTOSTOP') {
    type = 'stop';
    name = upper;
  } else if (str.startsWith('>>')) {
    type = 'section';
    flags.quickJump = true;
    name = str.substring(2).trim();
  } else if (str.startsWith('>')) {
    type = 'section';
    name = str.substring(1).trim();
  } else {
    type = 'song';
  }

  // Extract target BPM / tempo from tags, description, or raw name
  const targetTempo = extractTargetTempo(tags, description, rawName);

  return {
    rawName,
    type,
    name: name || rawName,
    description,
    chords,
    time,
    color,
    tags,
    duration,
    targetTempo,
    flags,
    transitionTarget,
  };
}

export function isChordProgression(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length === 0) return false;
  if (/^(?:chords?|ch|c)\s*:/i.test(trimmed)) return true;

  const tokens = trimmed.split(/[\s\-\|,\/>]+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;

  const chordRegex = /^[A-Ga-g][#b]?(?:m|maj|min|dim|aug|sus|add|\d)*(?:\/[A-Ga-g][#b]?)?$/;
  const validCount = tokens.filter(t => chordRegex.test(t)).length;
  return validCount > 0 && validCount >= Math.ceil(tokens.length * 0.75);
}

function extractTargetTempo(tags: string[], description?: string, rawName?: string): number | undefined {
  // 1. Check tags (e.g. #140bpm, #bpm140, #140)
  for (const tag of tags) {
    const match = tag.match(/^(?:bpm)?(\d+)(?:bpm)?$/i);
    if (match) {
      const bpm = parseInt(match[1], 10);
      if (bpm >= 40 && bpm <= 300) return bpm;
    }
  }

  // 2. Check description (e.g. {bpm:140} or {140bpm})
  if (description) {
    const match = description.match(/(?:bpm[:\s]*)?(\d+)\s*bpm/i) || description.match(/bpm[:\s]*(\d+)/i);
    if (match) {
      const bpm = parseInt(match[1], 10);
      if (bpm >= 40 && bpm <= 300) return bpm;
    }
  }

  // 3. Check rawName (e.g. [140bpm] or [bpm:140])
  if (rawName) {
    const match = rawName.match(/\[(?:bpm[:\s]*)?(\d+)\s*bpm\]/i) || rawName.match(/\[bpm[:\s]*(\d+)\]/i);
    if (match) {
      const bpm = parseInt(match[1], 10);
      if (bpm >= 40 && bpm <= 300) return bpm;
    }
  }

  return undefined;
}

function createEmptyFlags(): LocatorFlags {
  return {
    pause: false,
    loop: false,
    loopFull: false,
    skip: false,
    end: false,
    jump: false,
    stay: false,
    nosong: false,
    quickJump: false,
  };
}

function isColorName(str: string): boolean {
  const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'purple', 'pink', 'gray', 'grey', 'cyan', 'teal', 'amber'];
  return colors.includes(str.toLowerCase());
}
