/**
 * Splits a chord progression string into individual chord tokens.
 * Handles separators like spaces, dashes, pipes, and commas.
 */
export function parseChordTokens(chordsStr: string): string[] {
  if (!chordsStr) return [];
  return chordsStr
    .split(/[\s\-\|,\/>]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

/**
 * Creates a container HTMLElement displaying high-contrast chord badges/pills.
 */
export function renderChordPills(chordsStr: string, customClass: string = 'chord-progression-pills'): HTMLElement {
  const container = document.createElement('div');
  container.className = customClass;

  const tokens = parseChordTokens(chordsStr);
  if (tokens.length === 0) {
    const rawSpan = document.createElement('span');
    rawSpan.className = 'chord-pill';
    rawSpan.textContent = chordsStr;
    container.appendChild(rawSpan);
    return container;
  }

  tokens.forEach((chord, idx) => {
    const pill = document.createElement('span');
    pill.className = 'chord-pill';
    pill.textContent = chord;
    container.appendChild(pill);

    if (idx < tokens.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'chord-sep';
      sep.textContent = '•';
      container.appendChild(sep);
    }
  });

  return container;
}
