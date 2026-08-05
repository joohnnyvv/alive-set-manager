export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function beatsToSeconds(beats: number, tempo: number): number {
  if (tempo <= 0) return 0;
  return (beats / tempo) * 60;
}

export function formatClockTime(date: Date = new Date(), is24Hour: boolean = true): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  if (is24Hour) {
    return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
  } else {
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${minutes}:${seconds} ${period}`;
  }
}
