import raw from './japanmap.json';
import type { Item, StudyPlan } from './types';
import { Slot, shuffle } from './engine';

export interface MapData {
  vb: number[]; inset: number[];
  prefs: Record<string, { d: string; bb: number[]; c: number[]; r: string }>;
  regions: Record<string, { name: string; ids: string[]; vb: number[] }>;
}
export const MAP = raw as unknown as MapData;
export type MapMode = 'off' | 'area' | 'all';
export const mapOf = (p: StudyPlan): MapMode => (p.map === 'area' || p.map === 'all' ? p.map : 'off');

export interface MapView { vb: number[]; ids: string[]; region: string | null; inset: boolean }

/** Area = the prefecture's region (Hokkaido is alone, so it gets the whole-Japan map). */
export function viewFor(mode: 'area' | 'all', prefId: string): MapView {
  const rid = MAP.prefs[prefId]?.r;
  if (mode === 'all' || !rid || rid === 'hokkaido') return { vb: MAP.vb, ids: Object.keys(MAP.prefs), region: null, inset: true };
  const r = MAP.regions[rid];
  return { vb: r.vb, ids: r.ids, region: r.name, inset: rid === 'kyushu' };
}

/** The prefecture to colour in when this slot is a cue (the silhouette of a prefecture card). */
export const cueMapId = (slot: Slot, it: Item): string | null => (slot.type === 'image' && MAP.prefs[it.id] ? it.id : null);

/** The prefecture to tap when this slot is the answer: a prefecture's own silhouette, or a link to a prefecture. */
export function tapAnswer(slot: Slot, it: Item): string | null {
  if (slot.type === 'image' && MAP.prefs[it.id]) return it.id;
  if (slot.type === 'link') { const v = it.values[slot.key]; return MAP.prefs[v] ? v : null; }
  return null;
}

export interface Tap { correct: string; view: MapView; cand: string[]; n: number }
/** n = 2 or 4 candidates (right answer + look-alikes from the same map); 0 = every prefecture on the map is tappable. */
export function makeTap(correct: string, mode: 'area' | 'all', n: number, rnd: () => number = Math.random): Tap {
  const view = viewFor(mode, correct);
  const cand = n > 0 ? [correct, ...shuffle(view.ids.filter((x) => x !== correct), rnd).slice(0, n - 1)] : view.ids;
  return { correct, view, cand, n };
}
