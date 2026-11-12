import { useMemo, useState } from 'react';
import type { FacetDef, Item, Template } from './types';
import { World, hasText, titleOf, world } from './engine';
import { deleteItem, saveItem, useData } from './store';
import { ConfirmButton, FacetView, Facts, QuickFact, allPhotos, fileToDataURL } from './ui';
import { PrintCards } from './Print';
import { MAP } from './maps';

export type Editing = { id?: string; templateId?: string } | null;

export function Cards({ openId, setOpenId, edit }: { openId: string | null; setOpenId: (id: string | null) => void; edit: (e: Editing) => void }) {
  const d = useData();
  const w = useMemo(() => world(d.items, d.templates), [d.items, d.templates]);
  const [q, setQ] = useState('');
  const [tpl, setTpl] = useState('all');
  const [printing, setPrinting] = useState(false);
  const list = d.items.filter((i) => {
    if (tpl !== 'all' && i.templateId !== tpl) return false;
    const hay = Object.values(i.values).filter((v) => !v.startsWith('data:')).join(' ').toLowerCase() + ' ' + i.facts.map((f) => f.text).join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  if (printing) return <PrintCards back={() => setPrinting(false)} />;
  if (openId && w.items.get(openId)) return <Detail it={w.items.get(openId)!} w={w} back={() => setOpenId(null)} open={setOpenId} edit={edit} />;
  return (
    <div className="screen">
      <div className="topline"><h1>Cards</h1><span className="row-gap"><button className="link" onClick={() => setPrinting(true)}>🖨️ Print</button><button className="primary small" onClick={() => edit({})}>＋ Add</button></span></div>
      <input type="search" placeholder="Search names, kanji, facts…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {[['all', 'All'], ...d.templates.map((t) => [t.id, t.name])].map(([id, name]) => (
          <button key={id} className={`chip btn ${tpl === id ? 'on' : ''}`} onClick={() => setTpl(id)}>{name}</button>
        ))}
      </div>
      <p className="muted">{list.length} of {d.items.length} cards</p>
      <ul className="list">
        {list.map((i) => {
          const t = w.templates.get(i.templateId);
          const img = t?.facets.find((f) => f.type === 'image');
          const kj = t?.facets.find((f) => f.type === 'kanji');
          return (
            <li key={i.id} onClick={() => setOpenId(i.id)}>
              {img && hasText(i.values[img.key]) ? <img src={i.values[img.key]} alt="" /> : <span className="ph" />}
              <div><b>{titleOf(i, w)}</b><span lang="ja">{kj ? i.values[kj.key] : ''}</span></div>
              <em>{t?.name}</em>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Detail({ it, w, back, open, edit }: { it: Item; w: World; back: () => void; open: (id: string) => void; edit: (e: Editing) => void }) {
  const t = w.templates.get(it.templateId)!;
  const [mn, setMn] = useState(it.mnemonic);
  const backlinks = [...w.items.values()].filter((o) => w.templates.get(o.templateId)?.facets.some((f) => f.type === 'link' && o.values[f.key] === it.id));
  return (
    <div className="screen">
      <div className="topline"><button className="link" onClick={back}>‹ Back</button><button className="link" onClick={() => edit({ id: it.id })}>Edit</button></div>
      <h1>{titleOf(it, w)}</h1>
      {t.facets.map((f) => (
        <div key={f.key} className="detail-row">
          <span className="muted">{f.label}</span>
          {f.type === 'link' && w.items.get(it.values[f.key]) ? (
            <div onClick={() => open(it.values[f.key])} className="tap"><FacetView it={it} def={f} w={w} size="small" /></div>
          ) : (
            <FacetView it={it} def={f} w={w} size={f.type === 'image' ? 'small' : 'big'} />
          )}
          {f.type === 'image' && !MAP.prefs[it.id] && <Photos it={it} k={f.key} />}
        </div>
      ))}
      {backlinks.length > 0 && (
        <section>
          <h2>Linked from</h2>
          <ul className="list">
            {backlinks.map((o) => {
              const ot = w.templates.get(o.templateId)!; const img = ot.facets.find((f) => f.type === 'image');
              return <li key={o.id} onClick={() => open(o.id)}>{img ? <img src={o.values[img.key]} alt="" /> : <span className="ph" />}<div><b>{titleOf(o, w)}</b></div></li>;
            })}
          </ul>
        </section>
      )}
      <section>
        <h2>Your memory hook</h2>
        <textarea rows={2} value={mn} placeholder="A story or image that makes this stick…" onChange={(e) => setMn(e.target.value)} onBlur={() => mn !== it.mnemonic && saveItem({ ...it, mnemonic: mn })} />
      </section>
      <section>
        <h2>Facts</h2>
        <Facts it={it} />
        <QuickFact it={it} />
      </section>
      <ConfirmButton label="Delete this card" onConfirm={() => { deleteItem(it.id); back(); }} />
    </div>
  );
}

/** Extra photos for one image facet: add, make main, remove. */
function Photos({ it, k }: { it: Item; k: string }) {
  const extras = it.photos?.[k] ?? [];
  const [busy, setBusy] = useState(false);
  const put = (main: string, ex: string[]) => saveItem({ ...it, values: { ...it.values, [k]: main }, photos: { ...(it.photos ?? {}), [k]: ex }, updated: Date.now() });
  return (
    <div className="photos">
      <div className="muted">{allPhotos(it, k).length} photo{allPhotos(it, k).length === 1 ? '' : 's'}: Study picks one at random each time.</div>
      {extras.length > 0 && (
        <div className="photo-row">
          {extras.map((u, i) => (
            <div key={i} className="photo-cell">
              <img src={u} alt="" />
              <button className="link" onClick={() => put(u, [...extras.slice(0, i), it.values[k], ...extras.slice(i + 1)])}>Make main</button>
              <ConfirmButton label="Remove" confirmLabel="Sure?" onConfirm={() => put(it.values[k], extras.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
      )}
      <label className="addphoto">{busy ? 'Adding…' : '＋ Add another photo'}
        <input type="file" accept="image/*" disabled={busy} onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (!file) return;
          setBusy(true);
          try { put(it.values[k], [...extras, await fileToDataURL(file)]); } finally { setBusy(false); }
        }} />
      </label>
    </div>
  );
}

export function Form({ editing, done }: { editing: NonNullable<Editing>; done: (id?: string) => void }) {
  const d = useData();
  const w = useMemo(() => world(d.items, d.templates), [d.items, d.templates]);
  const existing = editing.id ? w.items.get(editing.id) : undefined;
  const [tid, setTid] = useState(existing?.templateId ?? editing.templateId ?? d.templates[0]?.id);
  const t = w.templates.get(tid ?? '') as Template | undefined;
  const [values, setValues] = useState<Record<string, string>>(existing?.values ?? {});
  const [mn, setMn] = useState(existing?.mnemonic ?? '');
  const [fact, setFact] = useState('');
  const [err, setErr] = useState('');
  if (!t) return <div className="screen"><p>Create a template first (Settings).</p><button onClick={() => done()}>Back</button></div>;
  const setV = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));

  function save() {
    if (!t) return;
    if (!hasText(values[t.titleKey])) { setErr(`Please fill in “${t.facets.find((f) => f.key === t.titleKey)?.label}”.`); return; }
    const now = Date.now();
    const id = existing?.id ?? `item-${now}`;
    const facts = [...(existing?.facts ?? [])];
    if (hasText(fact)) facts.push({ id: `f${now}`, text: fact.trim(), date: new Date().toISOString().slice(0, 10) });
    saveItem({ id, templateId: t.id, values, mnemonic: mn, facts, photos: existing?.photos, created: existing?.created ?? now, updated: now });
    done(id);
  }

  return (
    <div className="screen">
      <div className="topline"><button className="link" onClick={() => done(existing?.id)}>Cancel</button><button className="primary small" onClick={save}>Save</button></div>
      <h1>{existing ? 'Edit card' : 'New card'}</h1>
      {!existing && (
        <label>Type<select value={tid} onChange={(e) => { setTid(e.target.value); setValues({}); }}>{d.templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      )}
      {t.facets.map((f) => <Field key={f.key} f={f} v={values[f.key] ?? ''} set={(v) => setV(f.key, v)} w={w} self={existing?.id} />)}
      <label>Memory hook<textarea rows={2} value={mn} onChange={(e) => setMn(e.target.value)} placeholder="Optional story or image" /></label>
      {!existing && <label>First fact<input value={fact} onChange={(e) => setFact(e.target.value)} placeholder="Optional, e.g. Born in Sapporo" /></label>}
      {err && <div className="notice bad">{err}</div>}
    </div>
  );
}

function Field({ f, v, set, w, self }: { f: FacetDef; v: string; set: (v: string) => void; w: World; self?: string }) {
  if (f.type === 'image')
    return (
      <label>{f.label}
        {hasText(v) && <img className="img small" src={v} alt="" />}
        <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) set(await fileToDataURL(file)); }} />
      </label>
    );
  if (f.type === 'link') {
    const opts = [...w.items.values()].filter((i) => i.templateId === f.linkTemplate && i.id !== self).sort((a, b) => titleOf(a, w).localeCompare(titleOf(b, w)));
    return (
      <label>{f.label}
        <select value={v} onChange={(e) => set(e.target.value)}><option value="">— none —</option>{opts.map((o) => <option key={o.id} value={o.id}>{titleOf(o, w)}</option>)}</select>
      </label>
    );
  }
  return <label>{f.label}<input lang={f.type === 'text' || f.type === 'group' ? undefined : 'ja'} value={v} onChange={(e) => set(e.target.value)} placeholder={f.type === 'group' ? 'e.g. M or F' : undefined} /></label>;
}
