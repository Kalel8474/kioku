import assert from 'node:assert/strict';
import seed from '../src/seed.json';
import { schedule, newState } from '../src/srs';
import { world, pickNext, planStats, slotsOf, reverseIndex, cueOptions, makePlan, allRoles, type Ctx } from '../src/engine';
import type { Item, Template, Settings, SrsState, StudyPlan } from '../src/types';

const items = seed.items as Item[]; const templates = seed.templates as Template[];
const w = world(items, templates); const rev = reverseIndex(w);
const NOW = 1_800_000_000_000;
const mk = (roles: StudyPlan['roles'], random = false, cap = 15): Settings => ({ id: 'settings', newPerDay: cap, autoSpeak: false, scope: 'all', newToday: { date: 'd', count: 0 }, study: { roles, random } });
const ctx = (settings: Settings, states: SrsState[] = [], now = NOW, last: string | null = null): Ctx => ({ items, templates, states, settings, now, lastItemId: last });

// --- SRS
let s = newState('x', 'kanji', NOW);
s = schedule(s, 2, NOW); assert.equal(s.interval, 1); assert.equal(s.reps, 1);
s = schedule(s, 2, NOW); assert.equal(s.interval, 3);
s = schedule(s, 0, NOW); assert.equal(s.reps, 0); assert.equal(s.lapses, 1);
console.log('srs ok');

// --- roles
assert.deepEqual(allRoles(templates), ['Faces', 'Silhouettes', 'English', 'Kanji', 'Reading', 'Prefecture']);

// --- reverse faces: Aichi owns the faces of its two people
const aichi = w.items.get('pref-aichi')!;
const aslots = slotsOf(aichi, w, rev);
assert.deepEqual(aslots.filter((x) => x.type === 'reverse').map((x) => x.key).sort(), ['~person-hiroshi-tamaki:photo', '~person-ichiro-suzuki:photo']);
assert.ok(aslots.filter((x) => x.type === 'reverse').every((x) => x.role === 'Faces'));

// --- Example 1: Faces -> English => only people, cue photo, target name
let st: SrsState[] = [];
let t = pickNext(ctx(mk({ Faces: 'primary', English: 'secondary' }), st))!;
assert.ok(t.itemId.startsWith('person-')); assert.equal(t.cue.key, 'photo'); assert.deepEqual(t.targets.map((x) => x.slot.key), ['name']);
// --- Example 2: Faces -> Kanji
t = pickNext(ctx(mk({ Faces: 'primary', Kanji: 'secondary' }), st))!;
assert.equal(t.cue.key, 'photo'); assert.deepEqual(t.targets.map((x) => x.slot.key), ['kanji']);
// --- Example 3: Silhouettes -> English + Faces: Aichi test has name + both faces, each its own state
const only = (id: string) => ({ ...ctx(mk({ Silhouettes: 'primary', English: 'secondary', Faces: 'secondary' })), items: items.filter((i) => i.id === id || i.id.startsWith('person-')) });
t = pickNext({ ...only('pref-aichi'), items: items.filter((i) => ['pref-aichi', 'person-ichiro-suzuki', 'person-hiroshi-tamaki'].includes(i.id)) })!;
assert.equal(t.itemId.startsWith('pref-') ? t.cue.key : 'silhouette', 'silhouette');
if (t.itemId === 'pref-aichi') {
  assert.deepEqual(t.targets.map((x) => x.slot.key).sort(), ['name', '~person-hiroshi-tamaki:photo', '~person-ichiro-suzuki:photo']);
  assert.equal(new Set(t.targets.map((x) => x.state.id)).size, 3);
}
console.log('plan examples ok');

// --- only due targets are asked: grade 'good' on name, faces stay due
{
  const small = items.filter((i) => ['pref-aichi', 'person-ichiro-suzuki', 'person-hiroshi-tamaki'].includes(i.id));
  const c0 = { ...ctx(mk({ Silhouettes: 'primary', English: 'secondary', Faces: 'secondary' })), items: small };
  const first = pickNext(c0)!; assert.equal(first.itemId, 'pref-aichi'); assert.equal(first.targets.length, 3);
  const states = first.created.map((x) => (x.target === 'name' ? schedule(x, 2, NOW) : x));
  const again = pickNext({ ...c0, states, now: NOW + 1000 })!;
  assert.equal(again.targets.length, 2); assert.ok(again.targets.every((x) => x.slot.type === 'reverse'));
}
console.log('per-answer scheduling ok');

// --- ambiguous link cues: Prefecture -> Kanji. Ichiro (Aichi has 2 people) is excluded, Ayase (Hiroshima has 1) allowed
const plan = makePlan({ roles: { Prefecture: 'primary', Kanji: 'secondary' }, random: false });
const ich = w.items.get('person-ichiro-suzuki')!; const aya = w.items.get('person-haruka-ayase')!;
const kj = (it: Item) => slotsOf(it, w, rev).find((x) => x.key === 'kanji')!;
assert.equal(cueOptions(ich, kj(ich), slotsOf(ich, w, rev), plan, w).length, 0);
assert.equal(cueOptions(aya, kj(aya), slotsOf(aya, w, rev), plan, w).length, 1);
console.log('ambiguous cue rule ok');

// --- card order vs random
const firstIds = (random: boolean, n: number) => {
  const out: string[] = []; let states: SrsState[] = []; let last: string | null = null; const set = mk({ Faces: 'primary', English: 'secondary' }, random, 100);
  for (let i = 0; i < n; i++) { const p = pickNext(ctx(set, states, NOW, last), Math.random)!; states = [...states, ...p.created].map((x) => (p.targets.some((t) => t.state.id === x.id) ? schedule(x, 2, NOW) : x)); out.push(p.itemId); last = p.itemId; set.newToday.count += p.created.length; }
  return out;
};
const ordered = firstIds(false, 10); const a = firstIds(true, 10); const b = firstIds(true, 10);
assert.deepEqual(ordered, items.filter((i) => i.id.startsWith('person-')).slice(0, 10).map((i) => i.id), 'card order = card sequence');
assert.notDeepEqual(a, b, 'random runs differ'); assert.notDeepEqual(a, ordered);
console.log('random/order ok');

// --- stats + 40-day simulation (random mode, Faces+Silhouettes -> English + Kanji)
const set = mk({ Faces: 'primary', Silhouettes: 'primary', English: 'secondary', Kanji: 'secondary' }, true, 15);
let states: SrsState[] = []; let now = NOW; let last: string | null = null; let reviews = 0, caps = 0;
for (let day = 0; day < 40; day++) {
  set.newToday = { date: String(day), count: 0 };
  for (let n = 0; n < 500; n++) {
    const p = pickNext(ctx(set, states, now, last)); if (!p) break;
    if (p.created.length) { states = [...states, ...p.created]; set.newToday.count += p.created.length; }
    for (const { state: tgt } of p.targets) {
      const cur = states.find((x) => x.id === tgt.id)!; const upd = schedule(cur, 2, now);
      upd.cues = { ...cur.cues, [p.cue.key]: { seen: (cur.cues[p.cue.key]?.seen ?? 0) + 1, ok: (cur.cues[p.cue.key]?.ok ?? 0) + 1 } };
      states = states.map((x) => (x.id === upd.id ? upd : x)); reviews++;
    }
    assert.ok(p.targets.every((x) => x.slot.key !== p.cue.key)); last = p.itemId; now += 20_000;
  }
  if (day === 0) assert.ok(set.newToday.count >= 15 && set.newToday.count <= 15 + 3, `day-1 intro ${set.newToday.count}`);
  now = NOW + (day + 1) * 86_400_000;
}
const ps = planStats(ctx(set, states, now));
console.log('sim ok: answers graded', reviews, 'states', states.length, 'stats', JSON.stringify(ps));
assert.equal(ps.total, 77); assert.equal(ps.started, 77);

// --- multiple choice
import { makeChoices, choicesOf } from '../src/engine';
{
  assert.equal(choicesOf({ roles: {}, random: true }), 2); assert.equal(choicesOf({ roles: {}, random: true, choices: 4 }), 4); assert.equal(choicesOf({ roles: {}, random: true, choices: 0 }), 0);
  const val = (c: any) => (c.slot.type === 'reverse' ? w.items.get(c.slot.of)!.values[c.slot.def.key] : c.item.values[c.slot.key]);
  const ich = w.items.get('person-ichiro-suzuki')!;
  const nameSlot = slotsOf(ich, w, rev).find((x) => x.key === 'name')!;
  for (const n of [2, 4]) for (let k = 0; k < 200; k++) {
    const ch = makeChoices(ich, nameSlot, n, w, rev);
    assert.equal(ch.length, n); assert.equal(ch.filter((c) => c.correct).length, 1); assert.equal(new Set(ch.map(val)).size, n);
    assert.equal(ch.find((c) => c.correct)!.item.id, ich.id);
  }
  // link target: distractor prefectures are unique and never the right one
  const prefSlot = slotsOf(ich, w, rev).find((x) => x.key === 'prefecture')!;
  for (let k = 0; k < 100; k++) { const ch = makeChoices(ich, prefSlot, 4, w, rev); assert.equal(new Set(ch.map(val)).size, 4); assert.equal(ch.filter((c) => val(c) === 'pref-aichi').length, 1); }
  // reverse faces: Aichi's second celebrity is never offered as a wrong answer for the first
  const aslot = slotsOf(aichi, w, rev).find((x) => x.key === '~person-ichiro-suzuki:photo')!;
  const tam = w.items.get('person-hiroshi-tamaki')!.values.photo;
  for (let k = 0; k < 300; k++) { const ch = makeChoices(aichi, aslot, 4, w, rev); assert.ok(!ch.some((c) => !c.correct && val(c) === tam)); assert.equal(ch.length, 4); }
  // tiny deck: fewer candidates than n -> returns what exists
  const lone = items.filter((i) => i.id === 'person-ichiro-suzuki' || i.id === 'pref-aichi');
  const w2 = world(lone, templates); const r2 = reverseIndex(w2);
  assert.equal(makeChoices(ich, slotsOf(ich, w2, r2).find((x) => x.key === 'name')!, 4, w2, r2).length, 1);
  console.log('multiple choice ok');
}

// --- same-sex wrong choices
import { migrate, SEX_BY_NAME } from '../src/migrate';
{
  const m = migrate(templates, items);
  assert.equal(m.changedI.length, 30); assert.ok(m.templates.find((t) => t.id === 't-person')!.facets.some((f) => f.type === 'group'));
  assert.equal(migrate(m.templates, m.items).changedI.length, 0, 'idempotent');
  assert.equal(Object.keys(SEX_BY_NAME).length, 30);
  const w3 = world(m.items, m.templates); const r3 = reverseIndex(w3);
  const sx = (o: Item) => o.values.sex;
  // person targets (name, kanji, photo): wrong options share the right answer's sex
  for (const pid of ['person-suzu-hirose', 'person-ichiro-suzuki', 'person-orin']) {
    const p = w3.items.get(pid)!;
    for (const key of ['name', 'kanji', 'photo']) {
      const slot = slotsOf(p, w3, r3).find((x) => x.key === key)!;
      for (let k = 0; k < 150; k++) { const ch = makeChoices(p, slot, 4, w3, r3); assert.ok(ch.every((c) => sx(c.item) === sx(p)), `${pid}/${key}`); }
    }
  }
  // reverse faces: matches the sex of the celebrity being asked for (Tokyo has a man and a woman)
  const tokyo = w3.items.get('pref-tokyo')!;
  for (const [pid, sex] of [['person-shun-oguri', 'M'], ['person-ko-shibasaki', 'F']] as const) {
    const slot = slotsOf(tokyo, w3, r3).find((x) => x.key === `~${pid}:photo`)!;
    for (let k = 0; k < 150; k++) {
      const ch = makeChoices(tokyo, slot, 4, w3, r3);
      assert.ok(ch.every((c) => sx(w3.items.get(c.slot.of!)!) === sex), `faces for ${pid}`);
    }
  }
  // link target (which prefecture) is not restricted by sex
  const pr = slotsOf(w3.items.get('person-ichiro-suzuki')!, w3, r3).find((x) => x.key === 'prefecture')!;
  const sexes = new Set<string>(); for (let k = 0; k < 200; k++) makeChoices(w3.items.get('person-ichiro-suzuki')!, pr, 4, w3, r3).forEach((c) => sexes.add(sx(c.item)));
  assert.ok(sexes.has('F') && sexes.has('M'));
  // the group field is never a study element, cue, or target
  assert.ok(!allRoles(m.templates).some((r) => /sex/i.test(r)));
  // tiny group: falls back to the other sex rather than offering fewer options
  const few = m.items.filter((i) => ['person-suzu-hirose', 'person-ichiro-suzuki', 'person-orin', 'person-yui-aragaki'].includes(i.id) || i.id.startsWith('pref-'));
  const w4 = world(few, m.templates); const r4 = reverseIndex(w4);
  const sl = slotsOf(w4.items.get('person-orin')!, w4, r4).find((x) => x.key === 'name')!;
  assert.equal(makeChoices(w4.items.get('person-orin')!, sl, 4, w4, r4).length, 4);
  console.log('same-sex choices ok');
}
