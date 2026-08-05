export const colorMap: Record<string, string> = {
  red: '#ff5252',
  orange: '#ff9800',
  amber: '#ffc107',
  yellow: '#ffeb3b',
  lime: '#cddc39',
  green: '#4caf50',
  emerald: '#009688',
  teal: '#00bcd4',
  cyan: '#03a9f4',
  sky: '#2196f3',
  blue: '#3f51b5',
  indigo: '#673ab7',
  violet: '#9c27b0',
  purple: '#e91e63',
  fuchsia: '#ff4081',
  pink: '#ff80ab',
  rose: '#ff1744',
  gray: '#9e9e9e',
  grey: '#9e9e9e',
};

export function getCssColor(colorName?: string): string {
  if (!colorName) return 'var(--accent)';
  const lower = colorName.toLowerCase();
  return colorMap[lower] || lower;
}
