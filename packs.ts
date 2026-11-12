import type { Item } from './types';
import p2 from './pack-2026-11b.json';
import p3 from './pack-2026-11c.json';

/** Card packs shipped with the app. Each pack is added once to an existing deck (never again, so cards you delete stay deleted). */
const PACKS: { id: string; items: Item[] }[] = [p2, p3] as unknown as { id: string; items: Item[] }[];

export function applyPacks(items: Item[], applied: string[]) {
  const have = new Set(items.map((i) => i.id));
  const added: Item[] = [];
  const packs = [...applied];
  for (const p of PACKS) {
    if (packs.includes(p.id)) continue;
    for (const it of p.items) if (!have.has(it.id)) { added.push(it); have.add(it.id); }
    packs.push(p.id);
  }
  return { items: added.length ? [...items, ...added] : items, added, packs };
}
