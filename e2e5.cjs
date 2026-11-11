const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
const fs = require('fs');
const SEX = {}; const src = fs.readFileSync('/home/claude/kioku/src/migrate.ts', 'utf8');
for (const [, k, list] of src.matchAll(/const (F|M) = \[(.*?)\];/g)) for (const n of list.match(/'([^']+)'/g)) SEX[n.slice(1, -1)] = k;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  // simulate an OLD stored deck: strip the sex facet and values from IndexedDB, then reload
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('kioku'); r.onsuccess = () => { const db = r.result; const tx = db.transaction(['templates', 'items'], 'readwrite');
    const ts = tx.objectStore('templates'), is = tx.objectStore('items');
    ts.getAll().onsuccess = e => e.target.result.forEach(t => { t.facets = t.facets.filter(f => f.type !== 'group'); ts.put(t); });
    is.getAll().onsuccess = e => e.target.result.forEach(i => { delete i.values.sex; is.put(i); });
    tx.oncomplete = res; }; }));
  await p.reload(); await p.waitForSelector('text=What to study');
  const after = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('kioku'); r.onsuccess = () => { const q = r.result.transaction('items').objectStore('items').getAll(); q.onsuccess = () => res(q.result.filter(i => i.values.sex).length); }; }));
  console.log('old deck upgraded on load, people with sex set:', after);
  const roles = await p.$$eval('.role-row > span', e => e.map(x => x.innerText));
  console.log('picker elements:', roles.join(', '));
  // sample 2- and 4-choice questions: all options in a question must share the same sex
  let bad = 0, n = 0;
  for (const choices of ['2', '4']) {
    await p.click(`.role-row:has(> span:text-is("Choices")) button:text-is("${choices}")`);
    await p.click('text=Start studying');
    for (let i = 0; i < 25; i++) {
      await p.waitForSelector('button.choice:not([disabled])');
      const names = await p.$$eval('button.choice', bs => bs.map(x => x.innerText.trim()));
      await p.click('button.choice >> nth=0');
      const caps = await p.$$eval('button.choice .text.small', e => e.map(x => x.innerText.trim()));
      const opts = names.every(x => SEX[x]) ? names : caps;   // text options, or captions revealed for photo options
      if (!opts.length || !opts.some(x => SEX[x])) { await p.click('.primary.big'); continue; }
      const sexes = new Set(opts.map(x => SEX[x])); n++;
      if (sexes.size !== 1 || sexes.has(undefined)) { bad++; console.log('MIXED:', opts.join(' / ')); }
      await p.click('.primary.big');
    }
    await p.click('text=End');
  }
  console.log(`questions checked: ${n}, mixed-sex questions: ${bad}`);
  await p.click('nav >> text=Cards'); await p.fill('input[type=search]', 'hirose'); await p.click('.list li');
  console.log('detail shows Sex row:', await p.isVisible('text=Sex (keeps wrong choices alike)'));
  await p.screenshot({ path: '/tmp/sx.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });
