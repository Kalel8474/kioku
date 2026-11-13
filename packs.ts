import type { Item } from './types';
import p2 from './pack-2026-11b.json';
import p3 from './pack-2026-11c.json';
import p4 from './pack-2026-11d.json';

/** Card packs shipped with the app. Each pack is added once to an existing deck (never again, so cards you delete stay deleted). */
const PACKS: { id: string; items: Item[] }[] = [p2, p3, p4] as unknown as { id: string; items: Item[] }[];

/** One-time tagging of the cards whose show is known (their first fact). Runs once per deck; later tag edits are yours. */
const SHOW_TAGS: Record<string, string> = { 'Itte Q!': 'Itte Q', 'Cream Quiz': 'Cream Quiz' };
const TAGS_1 = 'tags-1';
/** One-time tags for cards that were in the deck before their group was tagged (the new pack's cards carry their own tags). */
const TAGS_2 = 'tags-2';
const OLD_TAGS: Record<string, string[]> = { 'person-takuya-kimura': ['SMAP'], 'person-kazunari-ninomiya': ['Arashi'], 'person-jun-matsumoto': ['Arashi'] };

export function applyPacks(items: Item[], applied: string[]) {
  const have = new Set(items.map((i) => i.id));
  const added: Item[] = [];
  const packs = [...applied];
  for (const p of PACKS) {
    if (packs.includes(p.id)) continue;
    for (const it of p.items) if (!have.has(it.id)) { added.push(it); have.add(it.id); }
    packs.push(p.id);
  }
  let all = added.length ? [...items, ...added] : items;
  const changed = [...added];
  if (!packs.includes(TAGS_1)) {
    const tagFor = new Map<string, string>();
    for (const it of (PACKS.find((p) => p.id === 'pack-2026-11b')?.items ?? [])) { const t = SHOW_TAGS[it.facts[0]?.text ?? '']; if (t) tagFor.set(it.id, t); }
    all = all.map((it) => {
      const t = tagFor.get(it.id);
      if (!t || it.tags?.includes(t)) return it;
      const n = { ...it, tags: [...(it.tags ?? []), t] };
      const k = changed.findIndex((c) => c.id === it.id);
      if (k >= 0) changed[k] = n; else changed.push(n);
      return n;
    });
    packs.push(TAGS_1);
  }
  if (!packs.includes(TAGS_2)) {
    all = all.map((it) => {
      const ts = (OLD_TAGS[it.id] ?? []).filter((t) => !it.tags?.includes(t));
      if (!ts.length) return it;
      const n = { ...it, tags: [...(it.tags ?? []), ...ts] };
      const k = changed.findIndex((c) => c.id === it.id);
      if (k >= 0) changed[k] = n; else changed.push(n);
      return n;
    });
    packs.push(TAGS_2);
  }
  return { items: all, added, changed, packs };
}
