/** 'group' is a label that is never studied; wrong multiple-choice options are drawn from cards with the same value (e.g. Sex). */
export type FacetType = 'text' | 'kanji' | 'reading' | 'image' | 'link' | 'group';

export interface FacetDef {
  key: string;
  label: string;
  type: FacetType;
  linkTemplate?: string; // for type 'link': template id of the linked item
  role?: string; // study element name shared across card types ("Faces", "English"); defaults to the label
}

/** A template describes one kind of thing to memorize (Prefecture, Person, Guitar chord, ...). */
export interface Template {
  id: string;
  name: string;
  titleKey: string; // facet used as the item's display name
  facets: FacetDef[];
}

/** Append-only extra knowledge attached to an item ("new movie she was in"). */
export interface Fact {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
  source?: string;
}

export interface Item {
  id: string;
  templateId: string;
  values: Record<string, string>; // facet key -> text | data URL | linked item id
  mnemonic: string;
  facts: Fact[];
  tags?: string[]; // groups you set yourself ("Cream Quiz", "Kanto"); a Study/Print/Cards filter picks one
  photos?: Record<string, string[]>; // extra photos per image facet key (the main one stays in values), e.g. a celebrity over the years
  created: number;
  updated: number;
}

export interface CueStat {
  seen: number;
  ok: number;
}

/** One spaced-repetition state per (item, target facet). The cue is chosen at random each review. */
export interface SrsState {
  id: string; // `${itemId}|${target}`
  itemId: string;
  target: string;
  due: number; // ms epoch
  interval: number; // days (0 = still learning)
  ease: number;
  reps: number;
  lapses: number;
  last: number;
  cues: Record<string, CueStat>; // how well each cue facet works for this target
  lastCue?: string;
}

export interface Settings {
  id: 'settings';
  newPerDay: number;
  autoSpeak: boolean;
  scope: string; // legacy, unused
  study: StudyPlan;
  newToday: { date: string; count: number };
  packs?: string[]; // card packs already added (so a card you delete is not added again)
}

export type Grade = 0 | 1 | 2 | 3; // again, hard, good, easy

/** Which elements to study: 'primary' = shown to you (cue), 'secondary' = what you recall. Missing = off. */
export interface StudyPlan {
  roles: Record<string, 'primary' | 'secondary'>;
  random: boolean;
  map?: 'off' | 'area' | 'all'; // prefecture silhouettes: show them on a map (area/all) and answer by tapping; off = bare silhouette
  names?: 'whole' | 'first' | 'last' | 'split'; // person names: whole, only first/last name, or both halves as two separate answers
  hint?: boolean; // when quizzing one half of a name, show the other half in the question (default on)
  tag?: string; // only study cards with this tag (missing/empty = all cards)
  choices?: number; // multiple choice: 0 = off (self-grade), 2 or 4 options. Missing = 2.
}
