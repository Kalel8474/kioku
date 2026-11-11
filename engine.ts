import type { FacetDef, FacetType, Item, Settings, SrsState, StudyPlan, Template } from './types';
import { newState } from './srs';

export const hasText = (v?: string) => !!v && v.trim() !== '';
const LEARN_AHEAD = 10 * 60_000;

export interface World {
  items: Map<string, Item>;
  templates: Map<string, Template>;
}
export const world = (items: Item[], templates: Template[]): World => ({
  items: new Map(items.map((i) => [i.id, i])),
  templates: new Map(templates.map((t) => [t.id, t])),
});

export const defOf = (t: Template, key: string): FacetDef | undefined => t.facets.find((f) => f.key === key);

export function titleOf(it: Item, w: World): string {
  const t = w.templates.get(it.templateId);
  return (t && it.values[t.titleKey]) || it.values[t?.facets[0]?.key ?? ''] || '(untitled)';
}

/** Facets that currently hold something (a link counts only if its target still exists). */
export function filledFacets(it: Item, w: World): FacetDef[] {
  const t = w.templates.get(it.templateId);
  if (!t) return [];
  return t.facets.filter((f) => f.type !== 'group' && hasText(it.values[f.key]) && (f.type !== 'link' || w.items.has(it.values[f.key])));
}

/** How many items point at the same linked item through the same link facet (e.g. 2 people from Aichi). */
export function linkSiblings(it: Item, key: string, w: World): number {
  let n = 0;
  for (const o of w.items.values()) if (o.templateId === it.templateId && o.values[key] === it.values[key]) n++;
  return n;
}

// ---------- study elements ("roles") ----------
// A role is the name the Study picker uses for one kind of element, shared across card types.
const SEED_ROLES: Record<string, Record<string, string>> = {
  't-person': { photo: 'Faces', name: 'English', prefecture: 'Prefecture' },
  't-prefecture': { silhouette: 'Silhouettes', name: 'English' },
};
export const roleOf = (t: Template, f: FacetDef) => f.role ?? SEED_ROLES[t.id]?.[f.key] ?? f.label;
const ROLE_ORDER = ['Faces', 'Silhouettes', 'English', 'Kanji', 'Reading', 'Prefecture'];

export function allRoles(templates: Template[]): string[] {
  const seen: string[] = [];
  for (const t of templates) for (const f of t.facets) { if (f.type === 'group') continue; const r = roleOf(t, f); if (!seen.includes(r)) seen.push(r); }
  const rank = (r: string) => (ROLE_ORDER.includes(r) ? ROLE_ORDER.indexOf(r) : 99);
  return seen.sort((a, b) => rank(a) - rank(b));
}

/**
 * Something on a card that can be shown or recalled. Besides the card's own facets, a card also
 * "owns" the images of the items that link to it (a prefecture owns the Faces of the people from there).
 */
export interface Slot {
  key: string; // facet key, or `~<linkingItemId>:<facetKey>` for a reverse slot
  role: string;
  type: FacetType | 'reverse';
  def: FacetDef;
  of?: string; // reverse slot: the linking item
}

export type ReverseIndex = Map<string, Item[]>;
export function reverseIndex(w: World): ReverseIndex {
  const idx: ReverseIndex = new Map();
  for (const o of w.items.values()) {
    const t = w.templates.get(o.templateId);
    const targets = new Set<string>();
    for (const f of t?.facets ?? []) if (f.type === 'link' && w.items.has(o.values[f.key])) targets.add(o.values[f.key]);
    targets.forEach((id) => idx.set(id, [...(idx.get(id) ?? []), o]));
  }
  return idx;
}

export function slotsOf(it: Item, w: World, rev: ReverseIndex): Slot[] {
  const t = w.templates.get(it.templateId);
  if (!t) return [];
  const own: Slot[] = filledFacets(it, w).map((f) => ({ key: f.key, role: roleOf(t, f), type: f.type, def: f }));
  const back: Slot[] = [];
  for (const o of rev.get(it.id) ?? []) {
    const ot = w.templates.get(o.templateId);
    for (const f of ot?.facets ?? [])
      if (f.type === 'image' && hasText(o.values[f.key])) back.push({ key: `~${o.id}:${f.key}`, role: roleOf(ot!, f), type: 'reverse', def: f, of: o.id });
  }
  return [...own, ...back];
}

// ---------- plan, cues ----------
export interface Plan { cues: Set<string>; targets: Set<string>; random: boolean }
export function makePlan(p: StudyPlan): Plan {
  const roles = Object.entries(p.roles);
  return { cues: new Set(roles.filter(([, v]) => v === 'primary').map(([k]) => k)), targets: new Set(roles.filter(([, v]) => v === 'secondary').map(([k]) => k)), random: p.random };
}

/** Cues allowed for a target: own slots in a Primary role. A link cue shared by several items can't cue a non-link target. */
export function cueOptions(it: Item, target: Slot, slots: Slot[], plan: Plan, w: World): Slot[] {
  return slots.filter(
    (s) => s.type !== 'reverse' && plan.cues.has(s.role) && s.key !== target.key && !(s.type === 'link' && target.type !== 'link' && linkSiblings(it, s.key, w) > 1),
  );
}

/** Weighted random cue: cues that have worked less well for this target come up more often. */
export function weightedCue(opts: Slot[], s: SrsState, rnd: () => number = Math.random): Slot {
  const weights = opts.map((o) => {
    const st = s.cues[o.key];
    const rate = ((st?.ok ?? 0) + 1) / ((st?.seen ?? 0) + 2);
    return (0.5 + (1 - rate) * 2) * (o.key === s.lastCue && opts.length > 1 ? 0.25 : 1);
  });
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < opts.length; i++) if ((r -= weights[i]) <= 0) return opts[i];
  return opts[opts.length - 1];
}

/** Items ordered so that anything an item links to comes first (prefecture before the person from there). */
export function orderedFor(items: Item[], templates: Template[]): Item[] {
  const tpls = new Map(templates.map((t) => [t.id, t]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const out: Item[] = [];
  const visit = (it: Item) => {
    if (seen.has(it.id)) return;
    seen.add(it.id);
    for (const f of tpls.get(it.templateId)?.facets ?? []) {
      const l = f.type === 'link' ? byId.get(it.values[f.key]) : undefined;
      if (l) visit(l);
    }
    out.push(it);
  };
  for (const it of [...items].sort((a, b) => a.created - b.created)) visit(it);
  return out;
}

export function shuffle<T>(a: T[], rnd: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

// ---------- picking the next test ----------
export interface Ctx {
  items: Item[];
  templates: Template[];
  states: SrsState[];
  settings: Settings;
  now: number;
  lastItemId: string | null;
}
export interface Test {
  itemId: string;
  cue: Slot;
  targets: { state: SrsState; slot: Slot }[]; // each answer is graded on its own
  created: SrsState[]; // brand-new states introduced for this test (caller persists + counts them)
}
interface Info { it: Item; slots: Slot[]; tslots: Slot[] }

function analyze(c: Ctx) {
  const w = world(c.items, c.templates);
  const rev = reverseIndex(w);
  const plan = makePlan(c.settings.study);
  const sm = new Map(c.states.map((s) => [s.id, s]));
  const info = new Map<string, Info>();
  for (const it of c.items) {
    const slots = slotsOf(it, w, rev);
    const tslots = slots.filter((s) => plan.targets.has(s.role) && cueOptions(it, s, slots, plan, w).length > 0);
    if (tslots.length) info.set(it.id, { it, slots, tslots });
  }
  return { w, plan, sm, info };
}

/** Numbers for the Study screen. */
export function planStats(c: Ctx) {
  const { sm, info } = analyze(c);
  let due = 0, started = 0;
  for (const [id, x] of info) {
    const have = x.tslots.map((t) => sm.get(`${id}|${t.key}`)).filter(Boolean) as SrsState[];
    due += have.filter((s) => s.due <= c.now).length;
    if (have.length) started++;
  }
  return { due, started, total: info.size };
}

export function pickNext(c: Ctx, rnd: () => number = Math.random): Test | null {
  const { w, plan, sm, info } = analyze(c);

  const build = (id: string, sts: SrsState[], created: SrsState[] = []): Test | null => {
    const x = info.get(id)!;
    const slotOf = (s: SrsState) => x.tslots.find((t) => t.key === s.target)!;
    const opts = cueOptions(x.it, slotOf(sts[0]), x.slots, plan, w);
    if (!opts.length) return null;
    const cue = weightedCue(opts, sts[0], rnd);
    const targets = sts.filter((s) => cueOptions(x.it, slotOf(s), x.slots, plan, w).some((o) => o.key === cue.key)).map((s) => ({ state: s, slot: slotOf(s) }));
    return { itemId: id, cue, targets, created };
  };
  const firstNotLast = (ids: string[]) => ids.find((i) => i !== c.lastItemId) ?? ids[0];
  const statesBy = (pred: (s: SrsState) => boolean) => {
    const m = new Map<string, SrsState[]>();
    for (const [id, x] of info) {
      const ss = x.tslots.map((t) => sm.get(`${id}|${t.key}`)).filter((s): s is SrsState => !!s && pred(s)).sort((a, b) => a.due - b.due);
      if (ss.length) m.set(id, ss);
    }
    return m;
  };

  // 1) reviews that are due. Random mode shuffles which card comes next; otherwise most overdue first.
  const due = statesBy((s) => s.due <= c.now);
  if (due.size) {
    const ids = [...due.keys()];
    const order = plan.random ? shuffle(ids, rnd) : ids.sort((a, b) => due.get(a)![0].due - due.get(b)![0].due);
    const t = build(firstNotLast(order), due.get(firstNotLast(order))!);
    if (t) return t;
  }

  // 2) new material, within the daily limit
  if (c.settings.newToday.count < c.settings.newPerDay) {
    const pool = [...info.values()].filter((x) => x.tslots.some((t) => !sm.has(`${x.it.id}|${t.key}`)));
    const ids = plan.random ? shuffle(pool.map((x) => x.it.id), rnd) : orderedFor(pool.map((x) => x.it), c.templates).map((i) => i.id);
    if (ids.length) {
      const id = firstNotLast(ids);
      const created = info.get(id)!.tslots.filter((t) => !sm.has(`${id}|${t.key}`)).map((t) => newState(id, t.key, c.now));
      const t = build(id, created, created);
      if (t) return t;
    }
  }

  // 3) cards still in the learning steps, a few minutes early
  const ahead = statesBy((s) => s.interval === 0 && s.due > c.now && s.due <= c.now + LEARN_AHEAD);
  if (ahead.size) {
    const ids = [...ahead.keys()].sort((a, b) => ahead.get(a)![0].due - ahead.get(b)![0].due);
    return build(firstNotLast(ids), ahead.get(firstNotLast(ids))!);
  }
  return null;
}

/**
 * Offline practice: every card in the chosen combination, started or not, in the plan's order (random or card order).
 * Nothing is saved: unstarted cards get throwaway states. `done` = cards already shown this round; when all have been, returns null.
 */
export function pickPractice(c: Ctx, done: Set<string>, rnd: () => number = Math.random): Test | null {
  const { w, plan, sm, info } = analyze(c);
  const pool = [...info.values()].filter((x) => !done.has(x.it.id));
  const ids = plan.random ? shuffle(pool.map((x) => x.it.id), rnd) : orderedFor(pool.map((x) => x.it), c.templates).map((i) => i.id);
  for (const id of ids) {
    const x = info.get(id)!;
    const sts = x.tslots.map((t) => sm.get(`${id}|${t.key}`) ?? newState(id, t.key, c.now));
    const slotOf = (s: SrsState) => x.tslots.find((t) => t.key === s.target)!;
    const opts = cueOptions(x.it, slotOf(sts[0]), x.slots, plan, w);
    if (!opts.length) continue;
    const cue = weightedCue(opts, sts[0], rnd);
    const targets = sts.filter((s) => cueOptions(x.it, slotOf(s), x.slots, plan, w).some((o) => o.key === cue.key)).map((s) => ({ state: s, slot: slotOf(s) }));
    if (targets.length) return { itemId: id, cue, targets, created: [] };
  }
  return null;
}

// ---------- multiple choice ----------
export const choicesOf = (p: StudyPlan): 0 | 2 | 4 => (p.choices === 0 || p.choices === 4 ? p.choices : 2);

export interface Choice {
  id: string;
  item: Item; // whose value this option shows (the card itself for the right answer, another card for a wrong one)
  slot: Slot;
  correct: boolean;
}

/**
 * n options for one target: the right answer plus look-alikes taken from other cards of the same kind.
 * Never repeats a value, and never offers another right answer (a second face from the same prefecture).
 */
export function makeChoices(it: Item, target: Slot, n: number, w: World, rev: ReverseIndex, rnd: () => number = Math.random): Choice[] {
  const gval = (x?: Item) => { const k = x && w.templates.get(x.templateId)?.facets.find((f) => f.type === 'group')?.key; return k ? x!.values[k] : undefined; };
  const rightVal = target.type === 'reverse' ? w.items.get(target.of!)?.values[target.def.key] : it.values[target.key];
  const seen = new Set([rightVal]);
  const same: Choice[] = [], other: Choice[] = []; // same = shares the group value (e.g. same sex) with the right answer
  if (target.type === 'reverse') {
    const host = w.items.get(target.of!);
    const want = gval(host);
    const mine = new Set((rev.get(it.id) ?? []).map((o) => o.id));
    for (const o of w.items.values()) {
      if (o.templateId !== host?.templateId || mine.has(o.id) || !hasText(o.values[target.def.key])) continue;
      if (seen.has(o.values[target.def.key])) continue;
      seen.add(o.values[target.def.key]);
      (want && gval(o) === want ? same : other).push({ id: `d-${o.id}`, item: it, slot: { ...target, key: `~${o.id}:${target.def.key}`, of: o.id }, correct: false });
    }
  } else {
    const want = target.type === 'link' ? undefined : gval(it);
    for (const o of w.items.values()) {
      const v = o.values[target.key];
      if (o.id === it.id || o.templateId !== it.templateId || !hasText(v) || seen.has(v)) continue;
      if (target.type === 'link' && !w.items.has(v)) continue;
      seen.add(v);
      (want && gval(o) === want ? same : other).push({ id: `d-${o.id}`, item: o, slot: target, correct: false });
    }
  }
  // prefer look-alikes from the same group; top up from the rest only if the group is too small
  const picked = [...shuffle(same, rnd), ...shuffle(other, rnd)].slice(0, n - 1);
  return shuffle([{ id: 'right', item: it, slot: target, correct: true }, ...picked], rnd);
}
