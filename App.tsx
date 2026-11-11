import { useEffect, useState } from 'react';
import { init, useData } from './store';
import { Study } from './Study';
import { Cards, Form, Editing } from './Cards';
import { Settings } from './Settings';

type Tab = 'study' | 'cards' | 'settings';

export function App() {
  const d = useData();
  const [tab, setTab] = useState<Tab>('study');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  useEffect(() => { init(); }, []);

  if (!d.ready) return <div className="screen"><p className="muted center">Loading…</p></div>;

  return (
    <div className="app">
      <main>
        {editing ? (
          <Form editing={editing} done={(id) => { setEditing(null); if (id) { setTab('cards'); setOpenId(id); } }} />
        ) : tab === 'study' ? (
          <Study />
        ) : tab === 'cards' ? (
          <Cards openId={openId} setOpenId={setOpenId} edit={setEditing} />
        ) : (
          <Settings />
        )}
      </main>
      <nav>
        {([['study', '🎴', 'Study'], ['cards', '🗂️', 'Cards'], ['settings', '⚙️', 'Settings']] as [Tab, string, string][]).map(([id, icon, label]) => (
          <button key={id} className={tab === id && !editing ? 'on' : ''} onClick={() => { setEditing(null); setTab(id); if (id === 'cards') setOpenId(null); }}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
