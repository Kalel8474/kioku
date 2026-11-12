import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from './types';
import { allTags, reverseIndex, titleOf, world, World } from './engine';
import { useData } from './store';
import { allPhotos } from './ui';
import { MAP } from './maps';

/** Avery 28371: letter sheet, 10 cards of 3.5 x 2 in (2 columns x 5 rows), margins 0.5 in top/bottom and 0.75 in left/right. */
const PER_SHEET = 10;
const TINT: Record<string, string> = { hokkaido: '#e3eefc', tohoku: '#e4f3dd', kanto: '#fbe3e3', chubu: '#ece4f8', kansai: '#fdeed8', chugoku: '#dfeaf8', shikoku: '#f6f0d0', kyushu: '#fbe0ea' };

interface Parts { kanji?: string; name: string; img?: string; sil?: string; prefKanji?: string; prefName?: string; tint: string; facts: string[]; extra?: string[]; reading?: string; region?: string; isPref: boolean }

function parts(it: Item, w: World, rev: Map<string, Item[]>, photoIdx: number): Parts {
  const t = w.templates.get(it.templateId)!;
  const fImg = t.facets.find((f) => f.type === 'image'), fKj = t.facets.find((f) => f.type === 'kanji'), fRd = t.facets.find((f) => f.type === 'reading'), fLink = t.facets.find((f) => f.type === 'link');
  const pref = fLink ? w.items.get(it.values[fLink.key]) : undefined;
  const isPref = !!MAP.prefs[it.id];
  const pt = pref ? w.templates.get(pref.templateId) : undefined;
  const pImg = pt?.facets.find((f) => f.type === 'image'), pKj = pt?.facets.find((f) => f.type === 'kanji');
  const rid = MAP.prefs[isPref ? it.id : pref?.id ?? '']?.r;
  const photos = fImg ? allPhotos(it, fImg.key) : [];
  return {
    kanji: fKj ? it.values[fKj.key] : undefined,
    name: titleOf(it, w),
    img: isPref ? undefined : photos[Math.min(photoIdx, Math.max(0, photos.length - 1))],
    sil: isPref ? (fImg ? it.values[fImg.key] : undefined) : pref && pImg ? pref.values[pImg.key] : undefined,
    prefKanji: pref && pKj ? pref.values[pKj.key] : undefined,
    prefName: pref ? titleOf(pref, w) : undefined,
    tint: TINT[rid ?? ''] ?? '#eef3e8',
    facts: it.facts.map((f) => f.text),
    extra: isPref ? (rev.get(it.id) ?? []).map((o) => titleOf(o, w)) : undefined,
    reading: fRd ? it.values[fRd.key] : undefined,
    region: rid ? MAP.regions[rid].name : undefined,
    isPref,
  };
}

/** Side A: the green prefecture shape. Side B: photo, kanji, names, fun facts. */
function Side({ p, side, n }: { p: Parts; side: 'A' | 'B'; n: number }) {
  if (side === 'A') {
    return <div className="pc a">{p.sil ? <img className="pc-sil" src={p.sil} alt="" /> : <div className="pc-title">{p.name}</div>}</div>;
  }
  if (p.isPref) {
    return (
      <div className="pc b" style={{ background: p.tint }}>
        <div className="pc-num">{n}</div>
        <div className="pc-pref">
          <div className="pc-big" lang="ja">{p.kanji}</div>
          <div className="pc-en">{p.name}</div>
          {p.reading && <div className="pc-rd" lang="ja">{p.reading}</div>}
          {p.region && <div className="pc-rd">{p.region}</div>}
        </div>
        {p.sil && <img className="pc-ghost" src={p.sil} alt="" />}
        {p.extra && p.extra.length > 0 && <div className="pc-ppl">{p.extra.slice(0, 6).join(' · ')}</div>}
      </div>
    );
  }
  return (
    <div className="pc b" style={{ background: p.tint }}>
      <div className="pc-num">{n}</div>
      <div className="pc-head">
        {p.prefKanji && <div className="pc-big" lang="ja">{p.prefKanji}</div>}
        {p.prefName && <div className="pc-en">{p.prefName}</div>}
      </div>
      {p.sil && <img className="pc-ghost" src={p.sil} alt="" />}
      <div className="pc-body">
        {p.img ? <img className="pc-photo" src={p.img} alt="" /> : <div className="pc-photo" />}
        <div className="pc-txt">
          {p.kanji && <div className="pc-pk" lang="ja">{p.kanji}</div>}
          <div className="pc-pn">{p.name}</div>
          <ul>{p.facts.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

type Cell = { it: Item; n: number } | null;
function Page({ cells, side, w, rev, pick }: { cells: Cell[]; side: 'A' | 'B'; w: World; rev: Map<string, Item[]>; pick: Record<string, number> }) {
  return (
    <div className="sheet">
      {cells.map((c, i) => <div key={i} className="cell">{c && <Side p={parts(c.it, w, rev, pick[c.it.id] ?? 0)} side={side} n={c.n} />}</div>)}
    </div>
  );
}

export function PrintCards({ back }: { back: () => void }) {
  const d = useData();
  const w = useMemo(() => world(d.items, d.templates), [d.items, d.templates]);
  const rev = useMemo(() => reverseIndex(w), [w]);
  const [sel, setSel] = useState<string[]>([]);
  const [tpl, setTpl] = useState(d.templates.find((t) => t.facets.some((f) => f.type === 'link'))?.id ?? 'all');
  const [mirror, setMirror] = useState(true);
  const [which, setWhich] = useState<'both' | 'A' | 'B'>('both');
  const [pick, setPick] = useState<Record<string, number>>({});
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useState('');
  const number = useMemo(() => { const m = new Map<string, number>(); const seen: Record<string, number> = {}; for (const it of d.items) { seen[it.templateId] = (seen[it.templateId] ?? 0) + 1; m.set(it.id, seen[it.templateId]); } return m; }, [d.items]);
  const [tag, setTag] = useState('');
  const tags = allTags(d.items);
  const list = d.items.filter((i) => (tpl === 'all' || i.templateId === tpl) && (!tag || i.tags?.includes(tag)));
  const chosen = sel.map((id) => w.items.get(id)).filter((x): x is Item => !!x);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // sheets of 10; the back page is mirrored left-right so it lines up when printed double-sided (flip on the long edge)
  const sheets = useMemo(() => {
    const out: { front: Cell[]; back: Cell[] }[] = [];
    for (let i = 0; i < chosen.length; i += PER_SHEET) {
      const front: Cell[] = Array.from({ length: PER_SHEET }, (_, k) => { const it = chosen[i + k]; return it ? { it, n: number.get(it.id) ?? 0 } : null; });
      const bk: Cell[] = Array(PER_SHEET).fill(null);
      front.forEach((c, k) => { const row = Math.floor(k / 2), col = k % 2; bk[row * 2 + (mirror ? 1 - col : col)] = c; });
      out.push({ front, back: bk });
    }
    return out;
  }, [chosen, mirror, number]);
  const pages = sheets.flatMap((s, i) => [
    ...(which !== 'B' ? [{ key: `a${i}`, cells: s.front, side: 'A' as const }] : []),
    ...(which !== 'A' ? [{ key: `b${i}`, cells: s.back, side: 'B' as const }] : []),
  ]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => { try { window.print(); } catch { setMsg('Printing is not available here. Open the hosted app in your browser to print.'); } setPrinting(false); }, 250);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printing]);

  return (
    <div className="screen">
      <div className="topline"><button className="link" onClick={back}>‹ Back</button><span /></div>
      <h1>Print cards</h1>
      <p className="muted">For Avery 28371 business cards (10 per sheet, 3.5 × 2 in). Tick the cards to print. Side A is the green prefecture shape; side B is the photo, kanji, names and fun facts.</p>
      <div className="chips">
        {[['all', 'All'], ...d.templates.map((t) => [t.id, t.name])].map(([id, name]) => (
          <button key={id} className={`chip btn ${tpl === id ? 'on' : ''}`} onClick={() => setTpl(id)}>{name}</button>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="chips">
          {[['', 'Any tag'], ...tags.map(([t, n]) => [t, `${t} (${n})`])].map(([id, name]) => (
            <button key={id} className={`chip btn ${tag === id ? 'on' : ''}`} onClick={() => setTag(id)}>{name}</button>
          ))}
        </div>
      )}
      <div className="row-gap">
        <button className="link" onClick={() => setSel((s) => [...new Set([...s, ...list.map((i) => i.id)])])}>Select all shown</button>
        <button className="link" onClick={() => setSel([])}>Clear</button>
        <span className="muted">{chosen.length} selected · {sheets.length} sheet{sheets.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="list">
        {list.map((i) => {
          const t = w.templates.get(i.templateId)!; const img = t.facets.find((f) => f.type === 'image'); const kj = t.facets.find((f) => f.type === 'kanji');
          const photos = img ? allPhotos(i, img.key) : [];
          const on = sel.includes(i.id);
          return (
            <li key={i.id} className={on ? 'on' : ''}>
              <input type="checkbox" checked={on} onChange={() => toggle(i.id)} aria-label={`Print ${titleOf(i, w)}`} />
              {photos[0] ? <img src={photos[Math.min(pick[i.id] ?? 0, photos.length - 1)]} alt="" /> : <span className="ph" />}
              <div onClick={() => toggle(i.id)}><b>{titleOf(i, w)}</b><span lang="ja">{kj ? i.values[kj.key] : ''}</span></div>
              {photos.length > 1 && (
                <button className="link" onClick={() => setPick((p) => ({ ...p, [i.id]: ((p[i.id] ?? 0) + 1) % photos.length }))}>Photo {(pick[i.id] ?? 0) + 1}/{photos.length}</button>
              )}
            </li>
          );
        })}
      </ul>
      <section>
        <h2>Options</h2>
        <label className="check"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror side B (for double-sided, flip on long edge)</label>
        <div className="role-row"><span>Print</span>
          <div className="seg">
            {([['both', 'Both sides'], ['A', 'A only'], ['B', 'B only']] as const).map(([v, l]) => <button key={v} className={which === v ? 'on primary' : ''} onClick={() => setWhich(v)}>{l}</button>)}
          </div>
        </div>
        <p className="muted">Tip: print at 100% / actual size with no scaling, and test one sheet on plain paper first (hold it against a card sheet to check the alignment).</p>
      </section>
      {chosen.length > 0 && (
        <section>
          <h2>Preview (sheet 1)</h2>
          <div className="pv-wrap">{pages.slice(0, 2).map((p) => <div key={p.key} className="pv"><Page cells={p.cells} side={p.side} w={w} rev={rev} pick={pick} /></div>)}</div>
        </section>
      )}
      {msg && <div className="notice bad">{msg}</div>}
      <button className="primary big" disabled={!chosen.length} onClick={() => { setMsg(''); setPrinting(true); }}>{chosen.length ? `Print ${chosen.length} card${chosen.length === 1 ? '' : 's'}` : 'Select cards to print'}</button>
      {printing && createPortal(<div className="print-root">{pages.map((p) => <Page key={p.key} cells={p.cells} side={p.side} w={w} rev={rev} pick={pick} />)}</div>, document.body)}
    </div>
  );
}
