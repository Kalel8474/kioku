import { useState } from 'react';
import type { FacetDef, Item } from './types';
import { Slot, World, hasText, titleOf } from './engine';
import { saveItem, today } from './store';

export function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.85;
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().replace('_', '-').startsWith('ja'));
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}

/** What to say aloud for an item: its reading if it has one, else its kanji. */
export function spokenText(it: Item, w: World): string {
  const t = w.templates.get(it.templateId);
  const pick = (type: string) => t?.facets.filter((f) => f.type === type).map((f) => it.values[f.key]).find(hasText);
  return pick('reading') ?? pick('kanji') ?? '';
}

export async function fileToDataURL(file: File, max = 480): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/** Several photos per card: Study rotates through them. The pick is stable within one card (seed changes per card), different between cards. */
export const photoSeed = { v: 0 };
export function allPhotos(it: Item, key: string): string[] {
  return [it.values[key], ...(it.photos?.[key] ?? [])].filter((x) => !!x && x.trim() !== '');
}
export function photoFor(it: Item, key: string, rotate = false): string {
  const all = allPhotos(it, key);
  if (!rotate || all.length < 2) return it.values[key];
  let h = photoSeed.v;
  for (const ch of `${it.id}|${key}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return all[h % all.length];
}

export interface LinkShow { img: boolean; kanji: boolean; name: boolean }
export function FacetView({ it, def, w, size = 'big', show, rotate }: { it: Item; def: FacetDef; w: World; size?: 'big' | 'small'; show?: LinkShow; rotate?: boolean }) {
  const v = it.values[def.key];
  if (!hasText(v)) return <div className="empty">—</div>;
  if (def.type === 'image') return <img className={`img ${size}`} src={photoFor(it, def.key, rotate)} alt={def.label} />;
  if (def.type === 'link') {
    const l = w.items.get(v);
    const lt = l && w.templates.get(l.templateId);
    if (!l || !lt) return <div className="empty">—</div>;
    const img = lt.facets.find((f) => f.type === 'image');
    const kj = lt.facets.find((f) => f.type === 'kanji');
    return (
      <div className={`linkview ${size}`}>
        {img && (!show || show.img) && <img className={`img ${size}`} src={l.values[img.key]} alt="" />}
        {kj && (!show || show.kanji) && <div className={`kanji ${size}`}>{l.values[kj.key]}</div>}
        {(!show || show.name) && <div className="text small">{titleOf(l, w)}</div>}
      </div>
    );
  }
  const say = (def.type === 'kanji' || def.type === 'reading') && size === 'big';
  return (
    <div className="facet-text">
      <div className={`${def.type} ${size}`} lang={def.type === 'text' ? undefined : 'ja'}>{v}</div>
      {say && (
        <button className="icon" aria-label="Play audio" onClick={() => speak(def.type === 'reading' ? v : spokenText(it, w) || v)}>🔊</button>
      )}
    </div>
  );
}

export function ConfirmButton({ label, confirmLabel = 'Tap again to confirm', onConfirm, className = 'danger' }: { label: string; confirmLabel?: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button className={className} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else { setArmed(true); setTimeout(() => setArmed(false), 4000); } }}>
      {armed ? confirmLabel : label}
    </button>
  );
}

/** Append a dated fact to an item ("saw her in a new movie"). */
export function QuickFact({ it, onAdded }: { it: Item; onAdded?: () => void }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!hasText(text)) return;
    saveItem({ ...it, facts: [...it.facts, { id: `f${Date.now()}`, text: text.trim(), date: today() }] });
    setText('');
    onAdded?.();
  };
  return (
    <form className="row" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a fact… (new movie, hometown detail)" />
      <button type="submit" className="primary small">Add</button>
    </form>
  );
}

export function Facts({ it, limit }: { it: Item; limit?: number }) {
  const facts = [...it.facts].reverse().slice(0, limit);
  if (!facts.length) return null;
  return (
    <ul className="facts">
      {facts.map((f) => (
        <li key={f.id}><span className="date">{f.date}{f.source ? ` · ${f.source}` : ''}</span>{f.text}</li>
      ))}
    </ul>
  );
}

/** Shows one slot of a card: its own facet, or (for a reverse slot) a linked item's photo with its name. */
export function SlotView({ it, slot, w, size = 'big', show }: { it: Item; slot: Slot; w: World; size?: 'big' | 'small'; show?: LinkShow }) {
  if (slot.type === 'reverse') {
    const o = w.items.get(slot.of ?? '');
    if (!o) return null;
    return (
      <div className="linkview big">
        <img className={`img ${size}`} src={photoFor(o, slot.def.key, true)} alt="" />
        <div className="text small">{titleOf(o, w)}</div>
      </div>
    );
  }
  return <FacetView it={it} def={slot.def} w={w} size={size} show={show} rotate />;
}
