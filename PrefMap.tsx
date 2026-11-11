import { memo } from 'react';
import { MAP, MapView } from './maps';

interface Props {
  view: MapView;
  mark?: string; // colour this prefecture red (cue)
  cand?: string[]; // tappable prefectures (question); the rest of the area is greyed out
  onTap?: (id: string) => void;
  answer?: { correct: string; picked: string }; // after answering
}

function PrefMapBase({ view, mark, cand, onTap, answer }: Props) {
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
  return (
    <svg className="pm" viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label="Map of Japan">
      {view.inset && <rect className="pm-inset" x={ib[0]} y={ib[1]} width={ib[2]} height={ib[3]} rx="3" />}
      {ids.map((id) => {
        const c = cls(id);
        const tappable = live && candSet?.has(id) || (live && !candSet && inArea.has(id));
        return <path key={id} d={MAP.prefs[id].d} className={`pm-p ${c} ${tappable ? 'tap' : ''}`} data-id={id} onClick={tappable ? () => onTap!(id) : undefined} />;
      })}
      {halo && cand!.map((id) => <path key={'h' + id} d={MAP.prefs[id].d} className="pm-halo" data-halo={id} onClick={() => onTap!(id)} />)}
    </svg>
  );
}
export const PrefMap = memo(PrefMapBase);
