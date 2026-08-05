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

  // Extract description inside {curly braces}
  let description: string | undefined;
  const descMatch = str.match(/\{([^}]+)\}/);
  if (descMatch) {
    description = descMatch[1].trim();
    str = str.replace(/\{([^}]+)\}/, '').trim();
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

  return {
    rawName,
    type,
    name: name || rawName,
    description,
    time,
    color,
    tags,
    duration,
    flags,
    transitionTarget,
  };
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
