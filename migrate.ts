import type { Item, Template } from './types';

/**
 * v0.4: the Person card type gets a "Sex" grouping field so wrong multiple-choice options can match
 * (a woman's name is never offered next to a man's). Values come from public knowledge of the people
 * named on the cards, not from the photos. Safe to run repeatedly; only fills what is missing.
 */
const F = ['Suzu Hirose', 'Kanna Hashimoto', 'Haruka Ayase', 'Ko Shibasaki', 'Yukie Nakama', 'Masami Nagasawa', 'Haruna Kawaguchi', 'Fumi Nikaido', 'Tao Tsuchiya', 'Orin', 'Yui Aragaki', 'Keiko Kitagawa', 'Kasumi Arimura'];
const M = ['Yuzuru Hanyu', 'Yo Oizumi', 'Shun Oguri', 'Takeru Satoh', 'Sanma Akashiya', 'Yudai Chiba', 'Ken Yasuda', 'Hiroshi Abe', 'Ken Watanabe', 'Ichiro Suzuki', 'Masato Sakai', 'Hiroshi Tamaki', 'Tomoya Nakamura', 'Go Ayano', 'Jun Matsumoto', 'Koji Seto', 'Haruma Miura'];
export const SEX_BY_NAME: Record<string, 'F' | 'M'> = Object.fromEntries([...F.map((n) => [n, 'F']), ...M.map((n) => [n, 'M'])]);

export function migrate(templates: Template[], items: Item[]) {
  const changedT: Template[] = [];
  const changedI: Item[] = [];
  const outT = templates.map((t) => {
    if (t.id !== 't-person' || t.facets.some((f) => f.type === 'group')) return t;
    const n: Template = { ...t, facets: [...t.facets, { key: 'sex', label: 'Sex (keeps wrong choices alike)', type: 'group' }] };
    changedT.push(n);
    return n;
  });
  const outI = items.map((i) => {
    const sex = SEX_BY_NAME[i.values.name];
    if (i.templateId !== 't-person' || i.values.sex || !sex) return i;
    const n: Item = { ...i, values: { ...i.values, sex } };
    changedI.push(n);
    return n;
  });
  return { templates: outT, items: outI, changedT, changedI };
}
