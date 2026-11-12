import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from './types';
import { filledFacets, reverseIndex, titleOf, world, World } from './engine';
import { useData } from './store';
import { FacetView, Facts, QuickFact, allPhotos } from './ui';
import { PrefMap } from './PrefMap';
import { MAP, MapView, viewFor } from './maps';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[ōŌ]/g, 'o');
const thumbOf = (it: Item, w: World) => { const f = w.templates.get(it.templateId)?.facets.find((x) => x.type === 'image'); return f ? it.values[f.key] : undefined; };

/** Reference mode: look something up without being tested. */
export function Lookup() {
  const d = useData();
  const w = useMemo(() => world(d.items, d.templates), [d.items, d.templates]);
  const rev = useMemo(() => reverseIndex(w), [w]);
  const [q, setQ] = useState('');
  const [trail, setTrail] = useState<string[]>([]);
  const open = trail.length ? w.items.get(trail[trail.length - 1]) : undefined;
  const go = (id: string) => setTrail((t) => [...t, id]);

  // search text per item: every text/kanji/reading facet
  const hay = useMemo(() => d.items.map((it) => {
    const t = w.templates.get(it.templateId);
    const parts = (t?.facets ?? []).filter((f) => ['text', 'kanji', 'reading'].includes(f.type)).map((f) => it.values[f.key] ?? '');
    return { it, text: norm(parts.join(' ')), title: norm(titleOf(it, w)) };
  }), [d.items, w]);
  const hits = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    return hay.filter((h) => h.text.includes(n)).sort((a, b) => Number(b.title.startsWith(n)) - Number(a.title.startsWith(n)) || a.title.localeCompare(b.title)).slice(0, 30).map((h) => h.it);
  }, [q, hay]);

  if (open) return <Detail it={open} w={w} rev={rev} onOpen={go} onBack={() => setTrail((t) => t.slice(0, -1))} />;
  return (
    <div className="screen">
      <h1>Look up</h1>
      <input className="search" type="search" placeholder="Type a name, kanji or reading…" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" autoCorrect="off" />
      {q.trim() ? (
        hits.length ? (
          <div className="hits">
            {hits.map((it) => { const th = thumbOf(it, w); const t = w.templates.get(it.templateId); const kj = t?.facets.find((f) => f.type === 'kanji'); return (
              <button key={it.id} className="hit" onClick={() => go(it.id)}>
                {th ? <img src={th} alt="" /> : <span className="ph" />}
                <span className="ht"><b>{titleOf(it, w)}</b><em lang="ja">{kj ? it.values[kj.key] : ''}</em></span>
                <span className="muted">{t?.name}</span>
              </button>
            ); })}
          </div>
        ) : <p className="muted">No matches.</p>
      ) : (
        <>
          <p className="muted">Or tap a prefecture on the map. Pinch or scroll to zoom, drag to move. More names appear as you zoom in.</p>
          <JapanMap w={w} onPick={go} />
        </>
      )}
    </div>
  );
}

function Detail({ it, w, rev, onOpen, onBack }: { it: Item; w: World; rev: Map<string, Item[]>; onOpen: (id: string) => void; onBack: () => void }) {
  const t = w.templates.get(it.templateId);
  const isPref = !!MAP.prefs[it.id];
  const [all, setAll] = useState(false);
  const labels = useMemo(() => Object.fromEntries(Object.keys(MAP.prefs).map((id) => [id, w.items.get(id) ? titleOf(w.items.get(id)!, w) : ''])), [w]);
  const people = rev.get(it.id) ?? [];
  const facets = filledFacets(it, w);
  return (
    <div className="screen">
      <div className="topline"><button className="link" onClick={onBack}>‹ Back</button><span className="chip">{t?.name}</span><span /></div>
      <h1>{titleOf(it, w)}</h1>
      {isPref && (
        <>
          <div className="answer-box map">
            <PrefMap view={viewFor(all ? 'all' : 'area', it.id)} mark={it.id} labels={labels} onTap={(id) => id !== it.id && w.items.has(id) && onOpen(id)} />
          </div>
          <div className="seg">
            <button className={!all ? 'on primary' : ''} onClick={() => setAll(false)}>{MAP.regions[MAP.prefs[it.id].r].name} area</button>
            <button className={all ? 'on primary' : ''} onClick={() => setAll(true)}>All Japan</button>
          </div>
          <p className="muted">Tap another prefecture on the map to jump to it.</p>
        </>
      )}
      {facets.map((f) => (
        <div key={f.key} className="recap-row ref">
          <span className="muted">{f.label}</span>
          {f.type === 'link' ? (
            <button className="plain" onClick={() => onOpen(it.values[f.key])}><FacetView it={it} def={f} w={w} size="small" /></button>
          ) : (
            <FacetView it={it} def={f} w={w} size={f.type === 'image' && isPref ? 'small' : 'big'} />
          )}
          {f.type === 'image' && allPhotos(it, f.key).length > 1 && (
            <div className="photo-row">{allPhotos(it, f.key).slice(1).map((u, i) => <img key={i} className="thumb" src={u} alt="" />)}</div>
          )}
        </div>
      ))}
      {people.length > 0 && (
        <section>
          <h2>{isPref ? 'Celebrities from here' : 'Linked cards'}</h2>
          <div className="people">
            {people.map((o) => (
              <button key={o.id} className="person" onClick={() => onOpen(o.id)}>
                {thumbOf(o, w) && <img src={thumbOf(o, w)} alt="" />}
                <span>{titleOf(o, w)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {it.mnemonic && <p className="mnemonic">💡 {it.mnemonic}</p>}
      <Facts it={it} />
      <details className="recap"><summary>＋ Add a fact</summary><QuickFact it={it} /></details>
    </div>
  );
}

/** All 47 prefectures with names; pinch / wheel to zoom, drag to pan, tap one to open it. */
function JapanMap({ w, onPick }: { w: World; onPick: (id: string) => void }) {
  const full = MAP.vb; // x, y, w, h
  const [vb, setVb] = useState<number[]>(full);
  const box = useRef<HTMLDivElement>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const labels = useMemo(() => Object.fromEntries(Object.keys(MAP.prefs).map((id) => [id, w.items.get(id) ? titleOf(w.items.get(id)!, w) : ''])), [w]);
  const view: MapView = { vb, ids: Object.keys(MAP.prefs), region: null, inset: true };

  const clamp = (v: number[]) => {
    const wd = Math.min(full[2], Math.max(full[2] / 14, v[2])), ht = wd * (full[3] / full[2]);
    const x = Math.min(full[0] + full[2] - wd * 0.3, Math.max(full[0] - wd * 0.7, v[0]));
    const y = Math.min(full[1] + full[3] - ht * 0.3, Math.max(full[1] - ht * 0.7, v[1]));
    return [x, y, wd, ht];
  };
  const zoomAt = (cur: number[], f: number, fx: number, fy: number) => { // fx, fy = fraction of the box under the fingers
    const nw = cur[2] / f, nh = cur[3] / f;
    return clamp([cur[0] + (cur[2] - nw) * fx, cur[1] + (cur[3] - nh) * fy, nw, nh]);
  };
  const frac = (cx: number, cy: number) => { const r = box.current!.getBoundingClientRect(); return [(cx - r.left) / r.width, (cy - r.top) / r.height, r.width] as const; };

  useEffect(() => {
    const el = box.current!;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const [fx, fy] = frac(e.clientX, e.clientY); setVb((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), fx, fy)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const down = (e: React.PointerEvent) => { ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.current.size === 1) { moved.current = false; start.current = { x: e.clientX, y: e.clientY }; } };
  const move = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId); if (!p) return;
    const pts = [...ptrs.current.values()];
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6) moved.current = true;
    if (ptrs.current.size === 1) {
      const [, , wpx] = frac(e.clientX, e.clientY);
      const dx = (e.clientX - p.x) * (vb[2] / wpx), dy = (e.clientY - p.y) * (vb[2] / wpx);
      if (moved.current) setVb((v) => clamp([v[0] - dx, v[1] - dy, v[2], v[3]]));
    } else if (ptrs.current.size === 2) {
      const [a, b] = pts; const other = pts.find((q) => q !== p)!;
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      const mine = { x: e.clientX, y: e.clientY };
      const after = Math.hypot(mine.x - other.x, mine.y - other.y);
      const [fx, fy] = frac((mine.x + other.x) / 2, (mine.y + other.y) / 2);
      if (before > 0) setVb((v) => zoomAt(v, after / before, fx, fy));
      moved.current = true;
    }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); };
  const btn = (f: number) => setVb((v) => zoomAt(v, f, 0.5, 0.5));

  return (
    <div className="zoombox">
      <div className="zoom" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); moved.current = false; } }}>
        <PrefMap view={view} labels={labels} onTap={onPick} />
      </div>
      <div className="zoomctl">
        <button onClick={() => btn(1.6)} aria-label="Zoom in">＋</button>
        <button onClick={() => btn(1 / 1.6)} aria-label="Zoom out">－</button>
        <button onClick={() => setVb(full)} aria-label="Reset">⟲</button>
      </div>
    </div>
  );
}
