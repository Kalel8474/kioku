import { useMemo, useRef, useState } from 'react';
import type { Grade, SrsState, StudyPlan } from './types';
import { Choice, Slot, World, allRoles, choicesOf, defOf, filledFacets, makeChoices, makePlan, pickNext, pickPractice, planStats, reverseIndex, roleOf, titleOf, world } from './engine';
import { previewGrade, schedule } from './srs';
import { getData, saveSettings, saveStates, settingsToday, today, useData } from './store';
import { PrefMap } from './PrefMap';
import { MapMode, cueMapId, makeTap, mapOf, tapAnswer, viewFor, Tap } from './maps';
import { FacetView, Facts, QuickFact, SlotView, speak, spokenText } from './ui';

interface Cur { itemId: string; cue: Slot; targets: { state: SrsState; slot: Slot }[]; qs?: Choice[][]; taps?: (Tap | null)[] }
const GRADES: [string, Grade][] = [['Again', 0], ['Hard', 1], ['Good', 2], ['Easy', 3]];

export function Study() {
  const d = useData();
  const w = useMemo(() => world(d.items, d.templates), [d.items, d.templates]);
  const [cur, setCur] = useState<Cur | null>(null);
  const [shown, setShown] = useState(false);
  const [graded, setGraded] = useState<Record<string, Grade>>({});
  const [phase, setPhase] = useState<'home' | 'card' | 'done'>('home');
  const [count, setCount] = useState(0);
  const [qi, setQi] = useState(0); // multiple choice: which question of this card
  const [picked, setPicked] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  const prac = useRef(false); // extra practice: ignores due dates, never changes the schedule
  const [practice, setPractice] = useState(false);
  const practiced = useRef<Set<string>>(new Set());

  const now = Date.now();
  const settings = settingsToday(now);
  const plan: StudyPlan = settings.study;
  const roles = useMemo(() => allRoles(d.templates), [d.templates]);
  const p = makePlan(plan);
  const ctxNow = { items: d.items, templates: d.templates, states: d.states, settings, now, lastItemId: null };
  const stats = planStats(ctxNow);
  const newLeft = Math.max(0, settings.newPerDay - settings.newToday.count);
  const ready = p.cues.size > 0 && p.targets.size > 0;
  const canStart = ready && pickNext(ctxNow) !== null;
  const canPractice = ready && pickPractice(ctxNow, new Set()) !== null;
  const mature = d.states.filter((s) => s.interval >= 21).length;

  // how well each kind of cue works, across everything studied
  const cueStrength = useMemo(() => {
    const agg = new Map<string, { seen: number; ok: number }>();
    for (const s of d.states) {
      const it = w.items.get(s.itemId); const t = it && w.templates.get(it.templateId);
      if (!t) continue;
      for (const [k, st] of Object.entries(s.cues)) {
        const f = defOf(t, k);
        const label = `${t.name} · ${f ? roleOf(t, f) : k}`;
        const a = agg.get(label) ?? { seen: 0, ok: 0 };
        agg.set(label, { seen: a.seen + st.seen, ok: a.ok + st.ok });
      }
    }
    return [...agg.entries()].filter(([, a]) => a.seen >= 3).map(([label, a]) => ({ label, pct: Math.round((100 * a.ok) / a.seen), seen: a.seen })).sort((a, b) => a.pct - b.pct);
  }, [d.states, w]);

  const setRole = (role: string, v: 'off' | 'primary' | 'secondary') => {
    const roles = { ...plan.roles };
    if (v === 'off') delete roles[role]; else roles[role] = v;
    saveSettings({ study: { ...plan, roles } });
  };

  function next() {
    const t = Date.now();
    const s = settingsToday(t);
    const dd = getData();
    const cx = { items: dd.items, templates: dd.templates, states: dd.states, settings: s, now: t, lastItemId: last.current };
    const pick = prac.current ? pickPractice(cx, practiced.current) : pickNext(cx);
    if (!pick) { setCur(null); setPhase('done'); return; }
    if (prac.current) practiced.current.add(pick.itemId);
    if (pick.created.length) {
      saveStates(pick.created);
      saveSettings({ newToday: { date: today(t), count: s.newToday.count + pick.created.length } });
    }
    let qs: Choice[][] | undefined;
    const n = choicesOf(s.study);
    const mm = mapOf(s.study);
    const ww = world(dd.items, dd.templates); const rev = reverseIndex(ww); const it = ww.items.get(pick.itemId)!;
    // map mode: prefecture answers become "tap it on the map" questions
    const taps = pick.targets.map((tg) => { const id = mm !== 'off' ? tapAnswer(tg.slot, it) : null; return id ? makeTap(id, mm as 'area' | 'all', n) : null; });
    if (n > 0) {
      const all = pick.targets.map((tg, i) => (taps[i] ? [] : makeChoices(it, tg.slot, n, ww, rev)));
      if (all.every((c, i) => taps[i] || c.length >= 2)) qs = all; // too few look-alikes: fall back to recall + self-grade
    }
    setCur({ itemId: pick.itemId, cue: pick.cue, targets: pick.targets, qs, taps: taps.some(Boolean) ? taps : undefined });
    setQi(0);
    setPicked(null);
    setGraded({});
    setShown(false);
    setPhase('card');
  }

  function reveal() {
    setShown(true);
    if (settings.autoSpeak && cur) {
      const it = w.items.get(cur.itemId)!;
      const first = cur.targets.find((t) => t.slot.type === 'kanji' || t.slot.type === 'reading');
      if (first) speak(first.slot.type === 'reading' ? it.values[first.slot.key] : spokenText(it, w));
    }
  }

  function gradeOne(stateId: string, g: Grade, opts?: { manual?: boolean; ok?: boolean }) {
    if (!cur || graded[stateId] !== undefined) return;
    const base = cur.targets.find((t) => t.state.id === stateId)!.state;
    const st = getData().states.find((s) => s.id === stateId) ?? base;
    if (!prac.current) { // offline practice saves nothing at all
      const upd = schedule(st, g, Date.now());
      const cs = st.cues[cur.cue.key];
      upd.cues = { ...st.cues, [cur.cue.key]: { seen: (cs?.seen ?? 0) + 1, ok: (cs?.ok ?? 0) + ((opts?.ok ?? g >= 2) ? 1 : 0) } };
      upd.lastCue = cur.cue.key;
      saveStates([upd]);
    }
    const ng = { ...graded, [stateId]: g };
    setGraded(ng);
    if (!opts?.manual && cur.targets.every((t) => ng[t.state.id] !== undefined)) {
      last.current = cur.itemId;
      setCount((c) => c + 1);
      next();
    }
  }

  /** Multiple choice: a miss is Again; a right answer is Good from 4 options but only Hard from 2 (half of guesses are right). */
  function choose(c: Choice) {
    if (!cur?.qs || picked) return;
    const n = cur.qs[qi].length;
    setPicked(c.id);
    gradeOne(cur.targets[qi].state.id, c.correct ? (n <= 2 ? 1 : 2) : 0, { manual: true, ok: c.correct });
    const sl = cur.targets[qi].slot;
    if (settings.autoSpeak && (sl.type === 'kanji' || sl.type === 'reading')) { const it = w.items.get(cur.itemId)!; speak(sl.type === 'reading' ? it.values[sl.key] : spokenText(it, w)); }
  }
  /** Map question: tapping the right prefecture is Good (Hard when only 2 were offered); a miss is Again. */
  function tapPick(id: string) {
    const tp = cur?.taps?.[qi];
    if (!cur || !tp || picked) return;
    const ok = id === tp.correct;
    setPicked(id);
    gradeOne(cur.targets[qi].state.id, ok ? (tp.n === 2 ? 1 : 2) : 0, { manual: true, ok });
  }
  function selfGrade(g: Grade) {
    if (!cur || picked) return;
    setPicked('self');
    gradeOne(cur.targets[qi].state.id, g, { manual: true });
  }
  function advance() {
    if (!cur) return;
    if (qi + 1 < cur.targets.length) { setQi(qi + 1); setPicked(null); setShown(false); return; }
    last.current = cur.itemId;
    setCount((c) => c + 1);
    next();
  }

  if (phase === 'card' && cur) {
    const it = w.items.get(cur.itemId);
    const tpl = it && w.templates.get(it.templateId);
    if (!it || !tpl) { setTimeout(next, 0); return null; }
    const used = new Set([cur.cue.key, ...cur.targets.map((t) => t.slot.key)]);
    const others = filledFacets(it, w).filter((f) => !used.has(f.key));
    const single = cur.targets.length === 1;
    const mm: MapMode = mapOf(plan);
    const cm = mm !== 'off' ? cueMapId(cur.cue, it) : null;
    // a link cue (a person's prefecture) shows only the parts you have switched on: Silhouettes, Kanji, English. None switched on = show all.
    const on = (r: string) => plan.roles[r] !== undefined;
    const linkShow = on('Silhouettes') || on('Kanji') || on('English') ? { img: on('Silhouettes'), kanji: on('Kanji'), name: on('English') } : undefined;
    const cueBox = (
      <div className={`cue-box ${cm ? 'map' : ''}`}>
        {cm ? <PrefMap view={viewFor(mm as 'area' | 'all', cm)} mark={cm} /> : <SlotView it={it} slot={cur.cue} w={w} show={linkShow} />}
      </div>
    );
    const roleCounts = cur.targets.reduce((m, t) => m.set(t.slot.role, (m.get(t.slot.role) ?? 0) + 1), new Map<string, number>());
    const gradeRow = (st: SrsState, sticky: boolean) => (
      <div className={`grades ${sticky ? 'sticky' : 'inline'}`}>
        {GRADES.map(([label, g]) => (
          <button key={g} className={`grade g${g} ${graded[st.id] === g ? 'picked' : ''}`} disabled={graded[st.id] !== undefined} onClick={() => gradeOne(st.id, g)}>
            {label}<small>{previewGrade(getData().states.find((s) => s.id === st.id) ?? st, g, Date.now())}</small>
          </button>
        ))}
      </div>
    );
    const recapBlock = (
      <>
        {(others.length > 0 || it.mnemonic || it.facts.length > 0) && (
          <details className="recap">
            <summary>Rest of this card</summary>
            {others.map((f) => (
              <div key={f.key} className="recap-row"><span className="muted">{f.label}</span><SlotView it={it} slot={{ key: f.key, role: f.label, type: f.type, def: f }} w={w} size="small" /></div>
            ))}
            {it.mnemonic && <p className="mnemonic">💡 {it.mnemonic}</p>}
            <Facts it={it} limit={4} />
          </details>
        )}
        <details className="recap"><summary>＋ Add a fact</summary><QuickFact it={it} /></details>
      </>
    );
    if (cur.qs || cur.taps?.some(Boolean)) {
      const tp = cur.taps?.[qi] ?? null;
      const q = cur.qs?.[qi];
      const tgt = cur.targets[qi];
      const visual = tgt.slot.type === 'reverse' || tgt.slot.type === 'image' || tgt.slot.type === 'link';
      const right = !picked ? undefined : tp ? picked === tp.correct : q ? q.find((c) => c.id === picked)?.correct : undefined;
      const ofN = cur.targets.length > 1 && <span className="muted"> ({qi + 1} of {cur.targets.length})</span>;
      const nameOf = (id: string) => { const o = w.items.get(id); return o ? titleOf(o, w) : id; };
      return (
        <div className="screen study">
          <div className="topline">
            <span className="chip">{tpl.name}</span>{practice && <span className="chip">Practice</span>}
            <span className="muted">{count} done</span>
            <button className="link" onClick={() => setPhase('home')}>End</button>
          </div>
          <div className="cue-label">{cur.cue.role}</div>
          {cueBox}
          {tp ? (
            <>
              <div className="prompt">→ Tap the <b>prefecture</b> on the map{ofN}</div>
              <div className="answer-box map">
                <PrefMap view={tp.view} cand={tp.cand} onTap={tapPick} answer={picked ? { correct: tp.correct, picked } : undefined} />
              </div>
              {picked && <div className={`notice ${right ? 'good' : 'bad'}`}>{right ? `✓ ${nameOf(tp.correct)}` : `✗ That was ${nameOf(picked)}. The answer is ${nameOf(tp.correct)} (green).`}</div>}
            </>
          ) : q ? (
            <>
              <div className="prompt">→ Which is the <b>{tgt.slot.role}</b>?{ofN}</div>
              <div className={`choices ${visual ? 'visual' : ''}`}>
                {q.map((c) => (
                  <button key={c.id} className={`choice ${picked ? (c.correct ? 'right' : c.id === picked ? 'wrong' : 'dim') : ''}`} disabled={!!picked} onClick={() => choose(c)}>
                    <ChoiceBody c={c} w={w} named={!!picked} />
                  </button>
                ))}
              </div>
              {picked && <div className={`notice ${right ? 'good' : 'bad'}`}>{right ? '✓ Correct' : '✗ Not quite. The right answer is highlighted.'}</div>}
            </>
          ) : (
            <>
              <div className="prompt">→ Recall: <b>{tgt.slot.role}</b>{ofN}</div>
              {!shown ? (
                <button className="primary big" onClick={() => setShown(true)}>Show answer</button>
              ) : (
                <>
                  <div className="answer-box"><SlotView it={it} slot={tgt.slot} w={w} /></div>
                  {!picked && (
                    <div className="grades inline">
                      {GRADES.map(([l, g]) => <button key={g} className={`grade g${g}`} onClick={() => selfGrade(g)}>{l}</button>)}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {picked && (
            <>
              {recapBlock}
              <button className="primary big" onClick={advance}>{qi + 1 < cur.targets.length ? 'Next question' : 'Continue'}</button>
            </>
          )}
        </div>
      );
    }
    return (
      <div className="screen study">
        <div className="topline">
          <span className="chip">{tpl.name}</span>{practice && <span className="chip">Practice</span>}
          <span className="muted">{count} done</span>
          <button className="link" onClick={() => setPhase('home')}>End</button>
        </div>
        <div className="cue-label">{cur.cue.role}</div>
        {cueBox}
        <div className="prompt">→ Recall: <b>{[...roleCounts].map(([r, n]) => (n > 1 ? `${r} ×${n}` : r)).join(' · ')}</b></div>
        {!shown ? (
          <button className="primary big" onClick={reveal}>Show answer{single ? '' : 's'}</button>
        ) : (
          <>
            {cur.targets.map(({ state, slot }) => (
              <div key={state.id} className="ans-block">
                <div className="cue-label">{slot.role}</div>
                <div className="answer-box"><SlotView it={it} slot={slot} w={w} /></div>
                {!single && gradeRow(state, false)}
              </div>
            ))}
            {recapBlock}
            {single && gradeRow(cur.targets[0].state, true)}
          </>
        )}
      </div>
    );
  }

  const seg = (role: string) => {
    const v = plan.roles[role] ?? 'off';
    return (
      <div className="seg" role="group" aria-label={role}>
        {(['off', 'primary', 'secondary'] as const).map((k) => (
          <button key={k} className={v === k ? `on ${k}` : ''} onClick={() => setRole(role, k)}>{k === 'off' ? 'Off' : k === 'primary' ? 'Primary' : 'Secondary'}</button>
        ))}
      </div>
    );
  };

  return (
    <div className="screen">
      <h1>Study</h1>
      {phase === 'done' && (
        <div className="notice good">
          {practice ? (count > 0 ? `Practice round finished: ${count} cards. Nothing was saved.` : 'Nothing to practice with this combination.') : count > 0 ? `Session finished: ${count} cards.` : 'Nothing to review right now.'}{' '}
          {newLeft === 0 ? "You've reached today's new-card limit; raise it in Settings to learn more." : ''}
        </div>
      )}
      <section>
        <h2>What to study</h2>
        <p className="muted"><b>Primary</b> = shown to you. <b>Secondary</b> = what you recall. Elements set to Off are skipped (nothing is deleted).</p>
        {roles.map((r) => (
          <div key={r} className="role-row"><span>{r}</span>{seg(r)}</div>
        ))}
        <div className="role-row"><span>Order</span>
          <div className="seg">
            <button className={plan.random ? 'on primary' : ''} onClick={() => saveSettings({ study: { ...plan, random: true } })}>Random</button>
            <button className={!plan.random ? 'on primary' : ''} onClick={() => saveSettings({ study: { ...plan, random: false } })}>Card order</button>
          </div>
        </div>
        <div className="role-row"><span>Map</span>
          <div className="seg">
            {([['off', 'Off'], ['area', 'Area'], ['all', 'All']] as [MapMode, string][]).map(([v, l]) => (
              <button key={v} className={mapOf(plan) === v ? 'on primary' : ''} onClick={() => saveSettings({ study: { ...plan, map: v } })}>{l}</button>
            ))}
          </div>
        </div>
        <div className="role-row"><span>Choices</span>
          <div className="seg">
            {([[0, 'Off'], [2, '2'], [4, '4']] as [number, string][]).map(([v, l]) => (
              <button key={v} className={choicesOf(plan) === v ? 'on primary' : ''} onClick={() => saveSettings({ study: { ...plan, choices: v } })}>{l}</button>
            ))}
          </div>
        </div>
        <p className="muted">Map: shows a prefecture on a map of its area (Kansai…) or all Japan, and prefecture answers become "tap it on the map". Off: bare silhouette.</p>
        <p className="muted">Choices: pick the right answer from 2 or 4 options. Off: recall it yourself, then grade yourself.</p>
        {!ready && <div className="notice bad">Pick at least one Primary (shown) and one Secondary (recall).</div>}
      </section>
      <div className="stats">
        <div><b>{stats.due}</b><span>due now</span></div>
        <div><b>{newLeft}</b><span>new today</span></div>
        <div><b>{stats.started}/{stats.total}</b><span>cards started</span></div>
        <div><b>{mature}</b><span>well known</span></div>
      </div>
      <button className="primary big" disabled={!canStart} onClick={() => { prac.current = false; setPractice(false); setCount(0); last.current = null; next(); }}>
        {!ready ? 'Choose elements above' : canStart ? 'Start studying' : 'Nothing due right now'}
      </button>
      {ready && (
        <button className="secondary big" disabled={!canPractice} onClick={() => { prac.current = true; setPractice(true); practiced.current = new Set(); setCount(0); last.current = null; next(); }}>
          Practice anyway
        </button>
      )}
      {ready && <p className="muted">Practice anyway: offline practice of every card in this combination, started or not, in the order above. Nothing is saved: no schedule, no new-card count, no stats.</p>}
      {cueStrength.length > 0 && (
        <section>
          <h2>Cue strength</h2>
          <p className="muted">How often you recall things when shown each cue. Weaker cues appear more often.</p>
          {cueStrength.map((c) => (
            <div key={c.label} className="bar"><span>{c.label}</span><div><i style={{ width: `${c.pct}%` }} /></div><em>{c.pct}%</em></div>
          ))}
        </section>
      )}
    </div>
  );
}

function ChoiceBody({ c, w, named }: { c: Choice; w: World; named: boolean }) {
  const s = c.slot;
  if (s.type === 'reverse') {
    const o = w.items.get(s.of ?? '');
    return <><img className="img cb" src={o?.values[s.def.key]} alt="" />{named && o && <div className="text small">{titleOf(o, w)}</div>}</>;
  }
  if (s.def.type === 'image') return <><img className="img cb" src={c.item.values[s.key]} alt="" />{named && <div className="text small">{titleOf(c.item, w)}</div>}</>;
  if (s.def.type === 'link') return <FacetView it={c.item} def={s.def} w={w} size="small" />;
  return <div className={`${s.def.type} cb`} lang={s.def.type === 'text' ? undefined : 'ja'}>{c.item.values[s.key]}</div>;
}
