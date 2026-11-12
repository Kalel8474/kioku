import { useSyncExternalStore } from 'react';
import type { Item, Settings, SrsState, Template } from './types';
import seed from './seed.json';
import { migrate } from './migrate';
import { applyPacks } from './packs';

export interface Data {
  ready: boolean;
  persisted: boolean; // false => IndexedDB unavailable, changes live in memory only
  templates: Template[];
  items: Item[];
  states: SrsState[];
  settings: Settings;
}

export const today = (now = Date.now()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const defaultSettings = (): Settings => ({
  id: 'settings', newPerDay: 15, autoSpeak: false, scope: 'all', newToday: { date: today(), count: 0 },
  study: { roles: { Faces: 'primary', Silhouettes: 'primary', English: 'secondary' }, random: true, choices: 2 },
});

let data: Data = { ready: false, persisted: true, templates: [], items: [], states: [], settings: defaultSettings() };
const listeners = new Set<() => void>();
const set = (patch: Partial<Data>) => { data = { ...data, ...patch }; listeners.forEach((l) => l()); };
export const useData = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => data);
export const getData = () => data;

// ---------- IndexedDB (tiny promise wrapper) ----------
const STORES = ['templates', 'items', 'states', 'kv'] as const;
type StoreName = (typeof STORES)[number];
let dbp: Promise<IDBDatabase> | null = null;
const db = () =>
  (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('kioku', 1);
    r.onupgradeneeded = () => STORES.forEach((s) => r.result.createObjectStore(s, { keyPath: 'id' }));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
async function run<T>(store: StoreName, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = f(t.objectStore(store));
    t.oncomplete = () => res(req ? (req.result as T) : (undefined as T));
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
const idbAll = <T,>(s: StoreName) => run<T[]>(s, 'readonly', (o) => o.getAll());
const idbPut = (s: StoreName, rows: object[]) => run(s, 'readwrite', (o) => { rows.forEach((r) => o.put(r)); });
const idbDel = (s: StoreName, id: string) => run(s, 'readwrite', (o) => { o.delete(id); });
const idbClear = (s: StoreName) => run(s, 'readwrite', (o) => { o.clear(); });

async function persist(fn: () => Promise<unknown>) {
  if (!data.persisted) return;
  try { await fn(); } catch { set({ persisted: false }); }
}

// ---------- boot ----------
export async function init() {
  try {
    let [templates, items, states, kv] = await Promise.all([
      idbAll<Template>('templates'), idbAll<Item>('items'), idbAll<SrsState>('states'), idbAll<Settings>('kv'),
    ]);
    if (!templates.length && !items.length) {
      templates = seed.templates as Template[];
      items = seed.items as Item[];
      await idbPut('templates', templates);
      await idbPut('items', items);
    }
    const m = migrate(templates, items);
    templates = m.templates; items = m.items;
    if (m.changedT.length) await idbPut('templates', m.changedT);
    if (m.changedI.length) await idbPut('items', m.changedI);
    let settings: Settings = { ...defaultSettings(), ...(kv.find((k) => k.id === 'settings') ?? {}) };
    const pk = applyPacks(items, settings.packs ?? []);
    if (pk.changed.length) { items = pk.items; await idbPut('items', pk.changed); }
    if (pk.packs.length !== (settings.packs ?? []).length) { settings = { ...settings, packs: pk.packs }; await idbPut('kv', [settings]); }
    set({ ready: true, templates, items, states, settings });
  } catch {
    const m = migrate(seed.templates as Template[], seed.items as Item[]);
    set({ ready: true, persisted: false, templates: m.templates, items: applyPacks(m.items, []).items, states: [] });
  }
}

// ---------- mutations ----------
const upsert = <T extends { id: string }>(list: T[], rows: T[]) => {
  const m = new Map(list.map((x) => [x.id, x]));
  rows.forEach((r) => m.set(r.id, r));
  return [...m.values()];
};

export function saveItem(it: Item) {
  set({ items: upsert(data.items, [{ ...it, updated: Date.now() }]) });
  return persist(() => idbPut('items', [data.items.find((x) => x.id === it.id)!]));
}

export async function deleteItem(id: string) {
  const states = data.states.filter((s) => s.itemId !== id);
  const touched: Item[] = [];
  const items = data.items
    .filter((i) => i.id !== id)
    .map((i) => {
      const t = data.templates.find((x) => x.id === i.templateId);
      const links = t?.facets.filter((f) => f.type === 'link' && i.values[f.key] === id) ?? [];
      if (!links.length) return i;
      const n = { ...i, values: { ...i.values } };
      links.forEach((f) => (n.values[f.key] = ''));
      touched.push(n);
      return n;
    });
  const gone = data.states.filter((s) => s.itemId === id);
  set({ items, states });
  await persist(async () => {
    await idbDel('items', id);
    for (const s of gone) await idbDel('states', s.id);
    if (touched.length) await idbPut('items', touched);
  });
}

export function saveTemplate(t: Template) {
  set({ templates: upsert(data.templates, [t]) });
  return persist(() => idbPut('templates', [t]));
}
export async function deleteTemplate(id: string) {
  if (data.items.some((i) => i.templateId === id)) return false;
  set({ templates: data.templates.filter((t) => t.id !== id) });
  await persist(() => idbDel('templates', id));
  return true;
}

export function saveStates(rows: SrsState[]) {
  set({ states: upsert(data.states, rows) });
  return persist(() => idbPut('states', rows));
}

export function saveSettings(patch: Partial<Settings>) {
  const settings = { ...data.settings, ...patch };
  set({ settings });
  return persist(() => idbPut('kv', [settings]));
}

/** Settings with the daily "new cards" counter rolled over to today. */
export const settingsToday = (now = Date.now()): Settings => {
  const s = data.settings;
  return s.newToday.date === today(now) ? s : { ...s, newToday: { date: today(now), count: 0 } };
};

export const resetProgress = async () => {
  set({ states: [] });
  await persist(() => idbClear('states'));
  await saveSettings({ newToday: { date: today(), count: 0 } });
};

// ---------- backup ----------
export const exportJSON = () =>
  JSON.stringify({ app: 'kioku', version: 1, exported: new Date().toISOString(), templates: data.templates, items: data.items, states: data.states, settings: data.settings });

export async function importJSON(text: string): Promise<string | null> {
  let j: any;
  try { j = JSON.parse(text); } catch { return 'That file is not valid JSON.'; }
  if (j?.app !== 'kioku' || !Array.isArray(j.items) || !Array.isArray(j.templates)) return 'That does not look like a Kioku backup.';
  const settings: Settings = { ...defaultSettings(), ...(j.settings ?? {}), id: 'settings' };
  const m = migrate(j.templates, j.items);
  const pk = applyPacks(m.items, settings.packs ?? []);
  settings.packs = pk.packs;
  m.items = pk.items;
  set({ templates: m.templates, items: m.items, states: j.states ?? [], settings });
  await persist(async () => {
    for (const s of ['templates', 'items', 'states', 'kv'] as StoreName[]) await idbClear(s);
    await idbPut('templates', m.templates);
    await idbPut('items', m.items);
    await idbPut('states', j.states ?? []);
    await idbPut('kv', [settings]);
  });
  return null;
}
