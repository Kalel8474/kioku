import type { Grade, SrsState } from './types';

const MIN = 60_000;
const DAY = 86_400_000;

export const newState = (itemId: string, target: string, now: number): SrsState => ({
  id: `${itemId}|${target}`, itemId, target, due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, last: 0, cues: {},
});

/** Simplified SM-2. Learning cards (reps = 0) step through minutes, then graduate to days. */
export function schedule(s: SrsState, g: Grade, now: number): SrsState {
  const n: SrsState = { ...s, last: now, cues: { ...s.cues } };
  if (g === 0) {
    if (s.reps > 0) n.lapses = s.lapses + 1;
    n.reps = 0; n.interval = 0; n.ease = Math.max(1.3, s.ease - 0.2);
    n.due = now + MIN;
  } else if (s.reps === 0) {
    if (g === 1) { n.interval = 0; n.due = now + 5 * MIN; }
    else { n.reps = 1; n.interval = g === 2 ? 1 : 3; n.due = now + n.interval * DAY; }
  } else {
    let iv: number;
    if (g === 1) { iv = Math.max(1, Math.round(s.interval * 1.2)); n.ease = Math.max(1.3, s.ease - 0.15); }
    else if (g === 2) iv = Math.max(s.interval + 1, Math.round(s.interval * s.ease));
    else { iv = Math.max(s.interval + 2, Math.round(s.interval * s.ease * 1.3)); n.ease = s.ease + 0.1; }
    n.reps = s.reps + 1; n.interval = iv; n.due = now + iv * DAY;
  }
  return n;
}

export function fmtInterval(ms: number): string {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  const d = ms / DAY;
  if (d < 1) return `${Math.round(ms / (60 * MIN))}h`;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export const previewGrade = (s: SrsState, g: Grade, now: number) => fmtInterval(schedule(s, g, now).due - now);
