import { useState } from 'react';
import type { FacetDef, FacetType, Template } from './types';
import { deleteTemplate, exportJSON, importJSON, resetProgress, saveSettings, saveTemplate, useData } from './store';
import { ConfirmButton } from './ui';

const TYPES: [FacetType, string][] = [['text', 'Text'], ['kanji', 'Kanji / Japanese'], ['reading', 'Reading (kana)'], ['image', 'Image'], ['link', 'Link to another card type'], ['group', 'Grouping label (keeps wrong choices alike)']];

export function Settings() {
  const d = useData();
  const [editing, setEditing] = useState<Template | null>(null);
  const [msg, setMsg] = useState('');
  const [backup, setBackup] = useState('');

  if (editing) return <TemplateEditor t={editing} done={() => setEditing(null)} />;

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `kioku-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg('Backup downloaded (check your Downloads / Files).');
  };

  return (
    <div className="screen">
      <h1>Settings</h1>
      {!d.persisted && <div className="notice bad">Storage is unavailable in this browser: changes will be lost when you close the page. Export a backup often.</div>}
      <section>
        <h2>Study</h2>
        <label>New cards per day
          <select value={d.settings.newPerDay} onChange={(e) => saveSettings({ newPerDay: +e.target.value })}>
            {[5, 10, 15, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <p className="muted">Each card has several things to recall (photo, kanji, reading, name, prefecture…), and each counts as one new card.</p>
        <label className="check"><input type="checkbox" checked={d.settings.autoSpeak} onChange={(e) => saveSettings({ autoSpeak: e.target.checked })} /> Play Japanese audio automatically when the answer is a kanji or reading</label>
      </section>
      <section>
        <h2>Card types</h2>
        <p className="muted">A card type defines the pieces of one thing to memorize. Create new ones for chords, vocabulary, anything.</p>
        <ul className="list">
          {d.templates.map((t) => (
            <li key={t.id} onClick={() => setEditing(t)}><div><b>{t.name}</b><span>{t.facets.map((f) => f.label).join(' · ')}</span></div><em>{d.items.filter((i) => i.templateId === t.id).length} cards</em></li>
          ))}
        </ul>
        <button onClick={() => setEditing({ id: `tpl-${Date.now()}`, name: '', titleKey: 'name', facets: [{ key: 'name', label: 'Name', type: 'text' }] })}>＋ New card type</button>
      </section>
      <section>
        <h2>Backup</h2>
        <p className="muted">Your cards and progress are stored on this device only. Export a backup now and then.</p>
        <div className="row">
          <button onClick={download}>Download backup</button>
          <button onClick={() => navigator.clipboard?.writeText(exportJSON()).then(() => setMsg('Backup copied to clipboard.'), () => setBackup(exportJSON()))}>Copy backup</button>
        </div>
        <label>Restore from backup file<input type="file" accept="application/json,.json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setMsg((await importJSON(await f.text())) ?? 'Backup restored.'); }} /></label>
        {backup && <textarea readOnly rows={4} value={backup} onFocus={(e) => e.currentTarget.select()} />}
        {msg && <div className="notice good">{msg}</div>}
      </section>
      <section>
        <h2>Danger zone</h2>
        <ConfirmButton label="Reset all study progress" onConfirm={() => { resetProgress(); setMsg('Progress reset. Your cards are untouched.'); }} />
      </section>
      <p className="muted center">Kioku v0.1 · {d.items.length} cards · {d.states.length} study items</p>
    </div>
  );
}

function TemplateEditor({ t, done }: { t: Template; done: () => void }) {
  const d = useData();
  const isNew = !d.templates.some((x) => x.id === t.id);
  const [name, setName] = useState(t.name);
  const [facets, setFacets] = useState<FacetDef[]>(t.facets);
  const [titleKey, setTitleKey] = useState(t.titleKey);
  const [err, setErr] = useState('');
  const used = (k: string) => !isNew && d.items.some((i) => i.templateId === t.id && (i.values[k] ?? '') !== '');
  const upd = (i: number, p: Partial<FacetDef>) => setFacets((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));

  function save() {
    if (!name.trim()) return setErr('Give the card type a name.');
    if (facets.length < 2) return setErr('Add at least two pieces so there is something to quiz.');
    if (facets.some((f) => !f.label.trim())) return setErr('Every piece needs a label.');
    const keys = new Set(facets.map((f) => f.key));
    saveTemplate({ ...t, name: name.trim(), facets, titleKey: keys.has(titleKey) ? titleKey : facets[0].key });
    done();
  }
  const add = () => setFacets((fs) => [...fs, { key: `f${Date.now().toString(36)}`, label: '', type: 'text' }]);

  return (
    <div className="screen">
      <div className="topline"><button className="link" onClick={done}>Cancel</button><button className="primary small" onClick={save}>Save</button></div>
      <h1>{isNew ? 'New card type' : 'Edit card type'}</h1>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Guitar chord, Vocabulary" /></label>
      <h2>Pieces</h2>
      {facets.map((f, i) => (
        <div key={f.key} className="facet-edit">
          <input value={f.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="Label (e.g. Fingering diagram)" />
          <select value={f.type} onChange={(e) => upd(i, { type: e.target.value as FacetType })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          {f.type === 'link' && (
            <select value={f.linkTemplate ?? ''} onChange={(e) => upd(i, { linkTemplate: e.target.value })}>
              <option value="">Link to…</option>{d.templates.filter((x) => x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <label className="check"><input type="radio" name="title" checked={titleKey === f.key} onChange={() => setTitleKey(f.key)} /> Use as card title</label>
          {!used(f.key) && facets.length > 1 && <button className="link" onClick={() => setFacets((fs) => fs.filter((_, j) => j !== i))}>Remove piece</button>}
        </div>
      ))}
      <button onClick={add}>＋ Add piece</button>
      {err && <div className="notice bad">{err}</div>}
      {!isNew && <ConfirmButton label="Delete this card type" onConfirm={async () => { if (await deleteTemplate(t.id)) done(); else setErr('Delete its cards first.'); }} />}
    </div>
  );
}
