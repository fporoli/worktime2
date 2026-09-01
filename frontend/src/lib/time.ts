export function roundToStep(minute: number, step = 5): number {
  return Math.round(minute / step) * step;
}

export function minutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1440, totalMinutes));
  const h = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const m = (clamped % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function hhmmToMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

export function formatDuration(startMinute: number, endMinute: number): string {
  const total = endMinute - startMinute;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
