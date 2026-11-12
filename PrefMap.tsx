import { memo } from 'react';
import { MAP, MapView } from './maps';

interface Props {
  view: MapView;
  mark?: string; // colour this prefecture red (cue)
  cand?: string[]; // tappable prefectures (question); the rest of the area is greyed out
  onTap?: (id: string) => void;
  answer?: { correct: string; picked: string }; // after answering
  labels?: Record<string, string>; // reference mode: names written inside each prefecture (only where they fit)
}

function PrefMapBase({ view, mark, cand, onTap, answer, labels }: Props) {
  const inArea = new Set(view.ids);
  const candSet = cand ? new Set(cand) : null;
  const cls = (id: string) => {
    if (answer) return id === answer.correct ? 'right' : id === answer.picked ? 'wrong' : candSet?.has(id) ? 'cand' : inArea.has(id) ? 'dim' : 'out';
    if (id === mark) return 'mark';
    if (!inArea.has(id)) return 'out';
    if (candSet) return candSet.has(id) ? 'cand' : 'dim';
    return 'in';
  };
  const order = (id: string) => (cls(id) === 'out' ? 0 : cls(id) === 'dim' || cls(id) === 'in' ? 1 : 2);
  const ids = Object.keys(MAP.prefs).sort((a, b) => order(a) - order(b));
  const live = !!onTap && !answer;
  const halo = live && candSet && candSet.size <= 4; // small targets (Kagawa, Osaka...) get a fatter invisible tap area
  const [x, y, w, h] = view.vb;
  const ib = MAP.inset;
  // labels: a name is drawn only when it fits inside its prefecture at this zoom, so zooming in reveals more of them
  const PX = 360, FS = 8; // assumed on-screen map width and label size in px
  const ppu = PX / w, fs = FS / ppu;
  const lab = labels ? ids.filter((id) => {
    const t = labels[id]; const b = MAP.prefs[id].bb;
    return t && (inArea.has(id)) && x - 5 < MAP.prefs[id].c[0] && MAP.prefs[id].c[0] < x + w + 5 && (b[2] - b[0]) * ppu >= t.length * FS * 0.42 && (b[3] - b[1]) * ppu >= FS * 1.1;
  }) : [];
  return (
    <svg className="pm" viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label="Map of Japan">
      {view.inset && <rect className="pm-inset" x={ib[0]} y={ib[1]} width={ib[2]} height={ib[3]} rx="3" />}
      {ids.map((id) => {
        const c = cls(id);
        const tappable = live && candSet?.has(id) || (live && !candSet && inArea.has(id));
        return <path key={id} d={MAP.prefs[id].d} className={`pm-p ${c} ${tappable ? 'tap' : ''}`} data-id={id} onClick={tappable ? () => onTap!(id) : undefined} />;
      })}
      {lab.map((id) => <text key={'t' + id} className="pm-label" x={MAP.prefs[id].c[0]} y={MAP.prefs[id].c[1]} fontSize={fs}>{labels![id]}</text>)}
      {halo && cand!.map((id) => <path key={'h' + id} d={MAP.prefs[id].d} className="pm-halo" data-halo={id} onClick={() => onTap!(id)} />)}
    </svg>
  );
}
export const PrefMap = memo(PrefMapBase);
